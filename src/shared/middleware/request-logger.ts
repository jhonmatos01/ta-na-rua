import type { IncomingMessage } from 'node:http';

import { pinoHttp } from 'pino-http';

import { logger } from '../../config/logger.js';

type RequestWithId = IncomingMessage & { requestId?: string };

export const requestLoggerMiddleware = pinoHttp({
  logger,
  customProps: (request) => {
    const requestId = (request as RequestWithId).requestId;
    return requestId === undefined ? {} : { requestId };
  },
});
