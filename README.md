## TX bot

A spam bot that continuously sends transactions to EVM endpoint.

### Overview

The bot runs as follows:

1.  Check orchestrator balance. Exit if balance below threshold.
2.  Deploy gas consumer contract.
3.  Create worker accounts and fund them.
4.  Run workers. Workers keep calling gas consumer contract's `go` method which is a loop that exits when gas used reaches a threshold.
5.  On insufficient funds, refund workers.

### Features

- Create workers (accounts) to prevent nonce issues.
- Deploy smart contract for workers to call.
- Manage nonce of workers to allow as many successful txs as possible.
- Fund and refund workers when they encounter insufficient fund error.
- Expose the following metrics:
  - `num_failed_tx`
  - `num_success_tx`
  - `fee_scucess_tx`
- Check orchestrator balance and exit if balance is below threshold.

### Environment variables

| variable               | description                                                        | required | default                |
| ---------------------- | ------------------------------------------------------------------ | -------- | ---------------------- |
| RPC_URL                | evm rpc url to send tx                                             | yes      | N/A                    |
| ORCH_PRIV_KEY          | orchestrator private key used to fund worker accounts              | yes      | N/A                    |
| ORCH_MIN_FUNDS_BASE    | minimum balance that orchestrator must have. Exit otherwise        | no       | `10000000000000000000` |
| NUMBER_OF_ACCOUNTS     | number of workers (accounts) that will send txs                    | no       | 10                     |
| FUNDS_PER_ACCOUNT_BASE | fund amount for workers used initially and on insufficient balance | no       | `1000000000000000000`  |
| WAIT_FOR_TX_MINE       | flag to determine whether to wait for tx to mine or not            | no       | false                  |
| GAS_CONSUME_PER_TX     | how much gas to use in gas-consumer worker                         | no       | `100000`               |
| LOG_LEVEL              | application logging level                                          | no       | info                   |
| SERVER_PORT            | port to run server on. Used to expose metrics                      | no       | 8080                   |

### Build

#### Run natively

```bash
npm install
export RPC_URL=http://evm-rpc-url:8545
export ORCH_PRIV_KEY=YOUR_FUNDER_ACCOUNT_PRIV_KEY
npx ts-node src/index.ts
```

#### Run using docker

```bash
docker build -t tx-bot-dev -f Dockerfile.dev .
docker run -it --init --rm --network=host -e RPC_URL=http://localhost:8545 -e ORCH_PRIV_KEY=YOUR_FUNDER_ACCOUNT_PRIV_KEY tx-bot-dev
```
