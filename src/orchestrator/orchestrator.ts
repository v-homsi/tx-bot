import { BigNumber, ContractFactory, providers, Signer, Wallet } from 'ethers';
import { getNativeCoinBalance, sendNativeCoin, sleep } from '../common/tx';
import { GasConsumerWorker } from '../worker/gas-consumer-worker';
import { IWorker } from '../worker/iworker';
import fs from 'fs';
import path from 'path';
import { NonceManager } from '@ethersproject/experimental';
import { Counter, Gauge } from 'prom-client';
import { Logger } from '../common/logger';

export interface OrchestratorParams {
  orchestratorAccountPrivKey: string;
  numberOfWorkers: number;
  fundAllocationPerAccountBASE: string;
  minFundsOrchestrator: string;
  rpcUrl: string;
  waitForTxMine: boolean;
  gasToConsumePerTx: string;
  logger: Logger;
}

export interface Contracts {
  gasConsumerContract?: string;
}

export class Orchestrator {
  private readonly params: OrchestratorParams;
  private workers: IWorker[] = [];
  private provider: providers.Provider;
  private readonly signer: NonceManager;
  private checkBalanceInterval?: NodeJS.Timer;
  private readonly contracts: Contracts = {};
  private isInitiliazing = true;
  private toFundQueue: IWorker[] = [];
  private isStopped = false;
  private readonly logger: Logger;
  private readonly successfulTxCounter = new Counter({
    name: 'num_success_tx',
    help: 'counter for number of successful txs',
    labelNames: ['worker']
  });
  private readonly failedTxCounter = new Counter({
    name: 'num_failed_tx',
    help: 'counter for number of failed txs',
    labelNames: ['worker', 'reason']
  });
  private readonly successfulTxFeeGauge = new Gauge({
    name: 'fee_success_tx',
    help: 'fee for successful tx',
    labelNames: ['worker']
  });

  constructor(params: OrchestratorParams) {
    this.params = params;
    this.provider = new providers.JsonRpcProvider(params.rpcUrl);
    this.signer = new NonceManager(
      new Wallet(params.orchestratorAccountPrivKey, this.provider)
    );
    this.logger = params.logger;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async onFailedTx(error: any) {
    try {
      let errorString = error.code;

      if (error.code == 'INSUFFICIENT_FUNDS') {
        this.logger.warn(`insufficient funds. need refunding`);
      } else if (error.code == 'SERVER_ERROR') {
        try {
          errorString = JSON.parse(error.body)['error']['message'];
          if (errorString.includes('nonce')) {
            errorString = 'INVALID_NONCE';
          }
        } catch (e) {
          errorString = error.code;
        }
      }

      this.logger.error('new failed tx', {
        error: errorString
      });
      this.failedTxCounter.inc({
        worker: 'orchestrator',
        reason: errorString
      });
      // reset nonce in case it's a nonce issue
      this.signer.setTransactionCount(await this.signer.getTransactionCount());
    } catch (err) {
      this.logger.error('error processing failed tx. Code error!', {
        error: error
      });
    }
  }

  async initialize() {
    this.isInitiliazing = true;
    this.logger.info('initializing orchestrator');
    await this._throwIfOrchestratorBalanceBelowThreshold();
    await this._initializeContracts();
    await this._initializeWorkers();
    this._initializeRefunder();
    this.isInitiliazing = false;
    return this;
  }

  async stop() {
    this.workers.map((worker) => worker.stop());
    if (this.checkBalanceInterval) clearInterval(this.checkBalanceInterval);
    this.isStopped = true;
    this.logger.info('stopped the orchestrator');
  }

  async _initializeWorkers() {
    this.logger.info('initializing workers');
    for (let i = 0; i < this.params.numberOfWorkers; i++) {
      // create account
      const workerWallet = Wallet.createRandom();

      // fund account
      await this._fundAccount(workerWallet.address, true);

      // create worker
      const worker = new GasConsumerWorker({
        waitForTxToMine: this.params.waitForTxMine,
        account: {
          privateKey: workerWallet.privateKey,
          address: workerWallet.address
        },
        provider: this.provider,
        contractAddress: this.contracts.gasConsumerContract
          ? this.contracts.gasConsumerContract
          : await this._deployGasConsumerContract(),
        gasToConsumePerTX: this.params.gasToConsumePerTx,
        successfulTxCounter: this.successfulTxCounter,
        failedTxCounter: this.failedTxCounter,
        onInsufficientFunds: async () => {
          this.toFundQueue.push(worker);
        },
        successfulTxFeeGauge: this.successfulTxFeeGauge,
        logger: this.logger
      });

      // start worker
      worker.run();

      // add worker to internal list
      this.workers.push();
    }
  }

  async _initializeContracts() {
    this.logger.info('initializing contracts');
    await this._deployGasConsumerContract();
  }

  async _initializeRefunder() {
    this.logger.info('initializing refunder');
    while (!this.isStopped) {
      if (!this.isInitiliazing && this.toFundQueue.length > 0) {
        while (this.toFundQueue.length > 0) {
          const worker = this.toFundQueue.shift();
          if (worker) {
            await this._fundAccount(worker.account.address);
            worker.hasBeenRefunded();
          }
        }
      } else {
        // sleep to prevent loop from running syncrhonously
        await sleep(1000);
      }
    }
  }

  async _fundAccount(
    address: string,
    waitForTxMine?: boolean
  ): Promise<boolean> {
    this.logger.info(`funding ${address}`);
    try {
      await this._throwIfOrchestratorBalanceBelowThreshold();
      await sendNativeCoin(
        this.signer,
        address,
        this.params.fundAllocationPerAccountBASE,
        waitForTxMine == undefined ? this.params.waitForTxMine : waitForTxMine
      );
      return true;
    } catch (e) {
      this.onFailedTx(e);
      this.logger.error('error funding address ', address);
      return false;
    }
  }

  async _deployGasConsumerContract(): Promise<string> {
    const metadata = JSON.parse(
      fs
        .readFileSync(path.join(process.cwd(), './contracts/GasConsumer.json'))
        .toString()
    );
    const factory = new ContractFactory(
      metadata.abi,
      metadata.bytecode,
      this.signer
    );

    try {
      const contract = await factory.deploy();
      await contract.deployTransaction.wait();
      this.logger.info('gas consumer contract deployed', {
        address: contract.address
      });
      this.contracts.gasConsumerContract = contract.address;
      return contract.address;
    } catch (e) {
      this.logger.error('error deploying contract. Exiting!', {
        error: e
      });
      throw e;
    }
  }

  async _throwIfOrchestratorBalanceBelowThreshold(): Promise<void> {
    const orchestratorBalance = await getNativeCoinBalance(
      this.provider,
      await this.signer.getAddress()
    );
    this.logger.info('orchestrator balance', {
      balance: orchestratorBalance.toString()
    });
    if (
      orchestratorBalance.lt(BigNumber.from(this.params.minFundsOrchestrator))
    ) {
      throw new Error('Insufficient funds in orchestrator account');
    }
  }
}
