import { LogLevel } from './logger';

export function stringFromEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} must be defined in environment variable`);
  }
  return value;
}

export function numberFromEnvOrDefault(key: string, def: number): number {
  let value: string | undefined | number = process.env[key];
  if (value == undefined) {
    value = def;
  }
  return Number(value);
}

export function stringFromEnvOrDefault(key: string, def: string): string {
  let value = process.env[key];
  if (!value) {
    value = def;
  }
  return value;
}

export function booleanFromEnvOrDefault(key: string, def: boolean): boolean {
  let value: string | undefined | boolean = process.env[key];
  if (value == undefined) {
    value = def;
  } else if (value.toUpperCase() == 'TRUE') {
    value = true;
  } else if (value.toUpperCase() == 'FALSE') {
    value = false;
  } else {
    value = def;
  }
  return value;
}

export function logLevelFromEnvOrDefault(key: string, def: LogLevel): LogLevel {
  const stringVal = stringFromEnvOrDefault(key, def);
  switch (stringVal) {
    case 'info':
    case 'debug':
    case 'warn':
    case 'error':
      return stringVal;
    default:
      return def;
  }
}
