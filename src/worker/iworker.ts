import { providers, Wallet } from 'ethers';
import { Counter, Gauge } from 'prom-client';
import { NonceManager } from '@ethersproject/experimental';
import { Logger } from '../common/logger';
import { sleep } from '../common/tx';

export interface Account {
  privateKey: string;
  address: string;
}

export interface IWorkerParams {
  waitForTxToMine: boolean;
  account: Account;
  provider: providers.Provider;
  successfulTxCounter: Counter<string>;
  failedTxCounter: Counter<string>;
  successfulTxFeeGauge: Gauge<string>;
  onInsufficientFunds: OnInsufficientFundsCallback;
  logger: Logger;
}

type OnInsufficientFundsCallback = () => Promise<void>;

export abstract class IWorker {
  private readonly waitForTxToMine: boolean;
  public readonly account: Account;
  private readonly successfulTxCounter: Counter<string>;
  private readonly failedTxCounter: Counter<string>;
  private readonly successfulTxFeeGauge: Gauge<string>;
  protected readonly signer: NonceManager;
  protected isLowOnFunds = false;
  private readonly onInsufficientFunds: OnInsufficientFundsCallback;
  private readonly logger: Logger;
  protected _isStopped = false;

  constructor(params: IWorkerParams) {
    this.waitForTxToMine = params.waitForTxToMine;
    this.account = params.account;
    this.signer = new NonceManager(
      new Wallet(params.account.privateKey, params.provider)
    );
    this.successfulTxCounter = params.successfulTxCounter;
    this.failedTxCounter = params.failedTxCounter;
    this.successfulTxFeeGauge = params.successfulTxFeeGauge;
    this.onInsufficientFunds = params.onInsufficientFunds;
    this.logger = params.logger.child({
      workerAddr: params.account.address
    });
  }

  async run(): Promise<void> {
    while (!this._isStopped) {
      if (!this.isLowOnFunds) {
        try {
          const txResponse = await this.sendTransaction();
          txResponse.wait().then((txReceipt: providers.TransactionReceipt) => {
            this.onSuccessfulTx(txReceipt);
          });
        } catch (e: unknown) {
          this.onFailedTx(e);
        }
      } else {
        // delay to prevent loop from running synchronously
        await sleep(1000);
      }
    }
  }

  abstract sendTransaction(): Promise<providers.TransactionResponse>;

  stop() {
    this._isStopped = true;
  }

  async onSuccessfulTx(receipt: providers.TransactionReceipt) {
    this.logger.debug('new successful tx', {
      hash: receipt.transactionHash,
      block: receipt.blockNumber,
      index: receipt.transactionIndex
    });
    this.successfulTxCounter.inc({
      worker: this.account.address
    });
    this.successfulTxFeeGauge.set(
      {
        worker: this.account.address
      },
      receipt.gasUsed.mul(receipt.effectiveGasPrice).toNumber()
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async onFailedTx(error: any) {
    try {
      let errorString = error.code;

      if (error.code == 'INSUFFICIENT_FUNDS') {
        this.logger.warn(`insufficient funds. need refunding`);
        this.isLowOnFunds = true;
        await this.onInsufficientFunds();
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
        worker: this.account.address,
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

  async hasBeenRefunded() {
    this.isLowOnFunds = false;
  }
}
