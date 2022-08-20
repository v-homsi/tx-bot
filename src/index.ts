import { getConfig } from './bot.config';
import { LoggerService } from './common/logger';
import { Orchestrator } from './orchestrator/orchestrator';
import { runServer } from './server/server';

async function run() {
  const config = getConfig();

  const logger = LoggerService.configure({
    logLevel: config.logLevel
  }).get();

  process.on('uncaughtException', (err) => {
    logger.error(err);
    process.exit(1);
  });

  process.on('unhandledRejection', (err) => {
    logger.error(err);
    process.exit(1);
  });

  runServer({
    port: config.serverPort,
    logger: logger
  });

  const orchestrator = new Orchestrator({
    orchestratorAccountPrivKey: config.orchestratorAccountPrivateKey,
    numberOfWorkers: config.numberOfAccounts,
    fundAllocationPerAccountBASE: config.fundsPerAccount,
    minFundsOrchestrator: config.orchestratorMinFunds,
    rpcUrl: config.rpcUrl,
    waitForTxMine: config.waitForTxToMine,
    gasToConsumePerTx: config.gasToConsumePerTx,
    logger: logger
  });

  await orchestrator.initialize();
}

run();
