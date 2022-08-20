import { Contract, providers } from 'ethers';
import { IWorker, IWorkerParams } from './iworker';

export interface GasConsumerWorkerParams extends IWorkerParams {
  contractAddress: string;
  gasToConsumePerTX: string;
}

const CONTRACT_INTERFACES = [
  'function go(uint256 gasAmount) public payable returns (uint256 gasUsed)'
];

export class GasConsumerWorker extends IWorker {
  private readonly params: GasConsumerWorkerParams;
  private readonly contract: Contract;

  constructor(params: GasConsumerWorkerParams) {
    super({
      account: params.account,
      waitForTxToMine: params.waitForTxToMine,
      provider: params.provider,
      successfulTxCounter: params.successfulTxCounter,
      failedTxCounter: params.failedTxCounter,
      onInsufficientFunds: params.onInsufficientFunds,
      logger: params.logger,
      successfulTxFeeGauge: params.successfulTxFeeGauge
    });

    this.params = params;
    this.contract = new Contract(
      params.contractAddress,
      CONTRACT_INTERFACES,
      this.signer
    );
  }

  async sendTransaction(): Promise<providers.TransactionResponse> {
    return this.contract.go(this.params.gasToConsumePerTX);
  }
}
