import type { Request } from 'express';
import { Router } from 'express';

import { createSuccessResponse } from '../../shared/http/responses.js';
import {
  authorizeRoles,
  createAuthenticate,
  createOptionalAuthenticate,
} from '../../shared/middleware/authorization.js';
import { parseInput } from '../../shared/validation/parse.js';
import type { RequestContext } from '../auth/auth.types.js';
import {
  PostgresIdentityRepository,
  type IdentityRepository,
} from '../auth/identity.repository.js';
import { DefaultPriorityService, type PriorityService } from '../confirmations/priority.service.js';
import { PostgresEvaluationsRepository } from './evaluations.repository.js';
import {
  createEvaluationSchema,
  evaluationListQuerySchema,
  evaluationOccurrenceIdParamsSchema,
  updateEvaluationSchema,
} from './evaluations.schemas.js';
import { DefaultEvaluationsService } from './evaluations.service.js';
import type { EvaluationsRepository, EvaluationsService } from './evaluations.types.js';

function requestContext(request: Request): RequestContext {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  };
}

export interface EvaluationsRouterOptions {
  identityRepository?: IdentityRepository;
  repository?: EvaluationsRepository;
  priorityService?: PriorityService;
  service?: EvaluationsService;
}

export function createEvaluationsRouter(options: EvaluationsRouterOptions = {}): Router {
  const identityRepository = options.identityRepository ?? new PostgresIdentityRepository();
  const repository = options.repository ?? new PostgresEvaluationsRepository();
  const priorityService = options.priorityService ?? new DefaultPriorityService();
  const service = options.service ?? new DefaultEvaluationsService(repository, priorityService);
  const authenticate = createAuthenticate(identityRepository);
  const optionalAuthenticate = createOptionalAuthenticate(identityRepository);
  const router = Router();

  router.post(
    '/:occurrenceId/evaluations',
    authenticate,
    authorizeRoles('CITIZEN'),
    async (request, response, next) => {
      try {
        const { occurrenceId } = parseInput(evaluationOccurrenceIdParamsSchema, request.params);
        const result = await service.create(
          request.auth!,
          occurrenceId,
          parseInput(createEvaluationSchema, request.body ?? {}),
          requestContext(request),
        );
        response.status(201).json(createSuccessResponse(request, result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.get('/:occurrenceId/evaluations', authenticate, async (request, response, next) => {
    try {
      const { occurrenceId } = parseInput(evaluationOccurrenceIdParamsSchema, request.params);
      const result = await service.list(
        request.auth!,
        occurrenceId,
        parseInput(evaluationListQuerySchema, request.query),
      );
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get(
    '/:occurrenceId/evaluations/summary',
    optionalAuthenticate,
    async (request, response, next) => {
      try {
        const { occurrenceId } = parseInput(evaluationOccurrenceIdParamsSchema, request.params);
        const result = await service.summary(request.auth, occurrenceId);
        response.status(200).json(createSuccessResponse(request, result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/:occurrenceId/evaluations/me',
    authenticate,
    authorizeRoles('CITIZEN'),
    async (request, response, next) => {
      try {
        const { occurrenceId } = parseInput(evaluationOccurrenceIdParamsSchema, request.params);
        const result = await service.getMine(request.auth!, occurrenceId);
        response.status(200).json(createSuccessResponse(request, result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    '/:occurrenceId/evaluations/me',
    authenticate,
    authorizeRoles('CITIZEN'),
    async (request, response, next) => {
      try {
        const { occurrenceId } = parseInput(evaluationOccurrenceIdParamsSchema, request.params);
        const result = await service.updateMine(
          request.auth!,
          occurrenceId,
          parseInput(updateEvaluationSchema, request.body ?? {}),
          requestContext(request),
        );
        response.status(200).json(createSuccessResponse(request, result));
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
