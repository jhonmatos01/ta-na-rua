import { Router } from 'express';

import { checkDatabaseHealth, type DatabaseHealth } from '../../database/health.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createSuccessResponse } from '../../shared/http/responses.js';

export type DatabaseHealthCheck = () => Promise<DatabaseHealth>;

export function createHealthRouter(
  databaseHealthCheck: DatabaseHealthCheck = checkDatabaseHealth,
): Router {
  const router = Router();

  router.get('/', (request, response) => {
    response.status(200).json(
      createSuccessResponse(request, {
        status: 'ok',
        timestamp: new Date().toISOString(),
      }),
    );
  });

  router.get('/database', async (request, response, next) => {
    try {
      const health = await databaseHealthCheck();
      response.status(200).json(createSuccessResponse(request, health));
    } catch (error) {
      request.log.warn(
        { err: error, requestId: request.requestId },
        'A verificacao de saude do banco falhou.',
      );
      next(
        new AppError(
          503,
          'DATABASE_UNAVAILABLE',
          'O banco de dados esta temporariamente indisponivel.',
        ),
      );
    }
  });

  return router;
}
