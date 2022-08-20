import { TransactionRequest } from '@ethersproject/providers';
import { BigNumber, providers, Signer } from 'ethers';

export async function sendNativeCoin(
  signer: Signer,
  toAddress: string,
  amountInBase: string,
  waitForTxToMine: boolean
) {
  const tx: TransactionRequest = {
    to: toAddress,
    value: BigNumber.from(amountInBase)
  };

  // const estimate = await signer.estimateGas(tx);

  // tx.gasLimit = estimate;

  const txResponse = await signer.sendTransaction(tx);

  if (waitForTxToMine) await txResponse.wait();
}

export async function getNativeCoinBalance(
  provider: providers.Provider,
  address: string
) {
  return provider.getBalance(address);
}

export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
