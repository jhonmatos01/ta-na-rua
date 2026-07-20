import type { ErrorRequestHandler } from 'express';

import { AppError } from '../errors/app-error.js';

interface BodyParserSyntaxError extends SyntaxError {
  status: number;
}

function isBodyParserSyntaxError(error: unknown): error is BodyParserSyntaxError {
  return error instanceof SyntaxError && 'status' in error && error.status === 400;
}

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (isBodyParserSyntaxError(error)) {
    return new AppError(400, 'INVALID_JSON', 'O corpo JSON enviado e invalido.');
  }

  return new AppError(500, 'INTERNAL_SERVER_ERROR', 'Ocorreu um erro interno inesperado.');
}

export const errorHandlerMiddleware: ErrorRequestHandler = (error, request, response, _next) => {
  const appError = normalizeError(error);

  if (appError.statusCode >= 500) {
    request.log.error(
      { err: error, requestId: request.requestId },
      'Erro nao tratado na requisicao.',
    );
  }

  response.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details,
    },
    meta: {
      requestId: request.requestId,
    },
  });
};
