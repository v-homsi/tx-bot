import express from 'express';
import promBundle from 'express-prom-bundle';
import { Logger } from '../common/logger';

export interface ServerParams {
  port: number;
  logger: Logger;
}

export async function runServer(params: ServerParams) {
  const app = express();
  const port = params.port; // default port to listen
  const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    includeStatusCode: true,
    includeUp: true,
    customLabels: {
      application: 'tx_bot'
    },
    promClient: {
      collectDefaultMetrics: {
      }
    }
  });

  app.use(metricsMiddleware);

  // start the express server
  app.listen(port, '0.0.0.0', () => {
    // tslint:disable-next-line:no-console
    params.logger.info(`server started at http://0.0.0.0:${port}`);
  });
}
