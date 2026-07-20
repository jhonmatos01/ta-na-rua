import { timingSafeEqual } from 'node:crypto';

import type { RequestHandler } from 'express';
import { Router } from 'express';

import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createSuccessResponse } from '../../shared/http/responses.js';
import { parseInput } from '../../shared/validation/parse.js';
import { aiInternalOccurrenceSchema } from './ai.schemas.js';
import { DefaultAiAnalysisService } from './ai.service.js';
import type { AiAnalysisService } from './ai.types.js';

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

const requireInternalAiSecret: RequestHandler = (request, _response, next) => {
  if (env.AI_SERVICE_SECRET === undefined) {
    next(
      new AppError(
        503,
        'AI_SERVICE_NOT_CONFIGURED',
        'A integracao interna com IA nao esta configurada.',
      ),
    );
    return;
  }
  const provided = request.get('x-ai-service-secret');
  if (provided === undefined || !secretsMatch(provided, env.AI_SERVICE_SECRET)) {
    next(new AppError(401, 'INVALID_AI_SERVICE_SECRET', 'Segredo interno de IA invalido.'));
    return;
  }
  next();
};

export interface AiRouterOptions {
  service?: AiAnalysisService;
}

export function createAiRouter(options: AiRouterOptions = {}): Router {
  const service = options.service ?? new DefaultAiAnalysisService();
  const router = Router();

  router.use(requireInternalAiSecret);

  router.post('/classify', async (request, response, next) => {
    try {
      const input = parseInput(aiInternalOccurrenceSchema, request.body);
      const analysis = await service.analyzeOccurrence(input.occurrenceId, 'CLASSIFICATION');
      response.status(200).json(createSuccessResponse(request, { analysis }));
    } catch (error) {
      next(error);
    }
  });

  router.post('/find-duplicates', async (request, response, next) => {
    try {
      const input = parseInput(aiInternalOccurrenceSchema, request.body);
      const analysis = await service.analyzeOccurrence(input.occurrenceId, 'DUPLICATE_DETECTION');
      response.status(200).json(createSuccessResponse(request, { analysis }));
    } catch (error) {
      next(error);
    }
  });

  router.post('/recalculate-priority', async (request, response, next) => {
    try {
      const input = parseInput(aiInternalOccurrenceSchema, request.body);
      const result = await service.recalculatePriority(input.occurrenceId);
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
