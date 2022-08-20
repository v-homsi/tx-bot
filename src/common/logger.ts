import { inspect } from 'util';
import { createLogger, format } from 'winston';
import { Logger as WLogger, transports } from 'winston';

export type Logger = WLogger;

export type LogLevel = 'info' | 'error' | 'warn' | 'debug';

export type LoggerConfig = {
  logLevel: LogLevel;
};

const logFormat = format.printf((info) => {
  const out = `${info.timestamp} ${
    info.metadata.service ? `[${info.metadata.service}]` : ''
  } ${info.level}: ${info.message} ${
    Object.entries(info.metadata).length !== 0
      ? inspect(info.metadata, {
          showHidden: false,
          depth: 5,
          colors: true,
          compact: 30,
          breakLength: 150
        })
      : ''
  }`; // message should always be the last item
  return out;
});

export class LoggerService {
  private static instance: Logger;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static get(): Logger {
    if (!LoggerService.instance)
      throw new Error(
        'LoggerService must be configured before obtaining an instance'
      );
    return LoggerService.instance;
  }

  public static configure(loggerConfig: LoggerConfig) {
    LoggerService.instance = createLogger({
      level: loggerConfig.logLevel,
      format: format.combine(
        format.metadata({
          fillExcept: ['message', 'level', 'timestamp', 'label']
        }),
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),

        format.errors({ stack: true }),
        format.splat(),
        // format.json(),

        format.prettyPrint(),
        format.colorize({ all: true }),
        logFormat
      ),
      transports: [new transports.Console()]
    });

    return this;
  }
}
