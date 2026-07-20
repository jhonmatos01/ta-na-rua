import pino, { type LoggerOptions } from 'pino';

import { env } from './env.js';

export const loggerOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: {
    service: 'ta-na-rua-api',
    environment: env.NODE_ENV,
  },
  redact: {
    censor: '[REDACTED]',
    paths: [
      'password',
      '*.password',
      'passwordHash',
      '*.passwordHash',
      'token',
      '*.token',
      'refreshToken',
      '*.refreshToken',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-ai-service-secret"]',
      'req.headers["x-webhook-signature"]',
      'req.headers["x-webhook-secret"]',
      'req.headers["x-telegram-bot-api-secret-token"]',
      'res.headers["set-cookie"]',
    ],
  },
};

export const logger = pino(loggerOptions);
