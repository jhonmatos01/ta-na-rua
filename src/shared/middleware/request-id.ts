import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

const MAX_REQUEST_ID_LENGTH = 128;

export const requestIdMiddleware: RequestHandler = (request, response, next) => {
  const suppliedRequestId = request.header('x-request-id')?.trim();
  const requestId =
    suppliedRequestId !== undefined &&
    suppliedRequestId.length > 0 &&
    suppliedRequestId.length <= MAX_REQUEST_ID_LENGTH
      ? suppliedRequestId
      : randomUUID();

  request.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
};
