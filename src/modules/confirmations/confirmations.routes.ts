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
import { PostgresConfirmationsRepository } from './confirmations.repository.js';
import {
  confirmationOccurrenceIdParamsSchema,
  createConfirmationSchema,
} from './confirmations.schemas.js';
import { DefaultConfirmationsService } from './confirmations.service.js';
import type { ConfirmationsRepository, ConfirmationsService } from './confirmations.types.js';
import { DefaultPriorityService, type PriorityService } from './priority.service.js';

function requestContext(request: Request): RequestContext {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  };
}

export interface ConfirmationsRouterOptions {
  identityRepository?: IdentityRepository;
  repository?: ConfirmationsRepository;
  priorityService?: PriorityService;
  service?: ConfirmationsService;
}

export function createConfirmationsRouter(options: ConfirmationsRouterOptions = {}): Router {
  const identityRepository = options.identityRepository ?? new PostgresIdentityRepository();
  const repository = options.repository ?? new PostgresConfirmationsRepository();
  const priorityService = options.priorityService ?? new DefaultPriorityService();
  const service = options.service ?? new DefaultConfirmationsService(repository, priorityService);
  const authenticate = createAuthenticate(identityRepository);
  const optionalAuthenticate = createOptionalAuthenticate(identityRepository);
  const router = Router();

  router.post(
    '/:occurrenceId/confirmations',
    authenticate,
    authorizeRoles('CITIZEN'),
    async (request, response, next) => {
      try {
        const { occurrenceId } = parseInput(confirmationOccurrenceIdParamsSchema, request.params);
        const result = await service.confirm(
          request.auth!,
          occurrenceId,
          parseInput(createConfirmationSchema, request.body ?? {}),
          requestContext(request),
        );
        response.status(201).json(createSuccessResponse(request, result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    '/:occurrenceId/confirmations/me',
    authenticate,
    authorizeRoles('CITIZEN'),
    async (request, response, next) => {
      try {
        const { occurrenceId } = parseInput(confirmationOccurrenceIdParamsSchema, request.params);
        await service.remove(request.auth!, occurrenceId, requestContext(request));
        response.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/:occurrenceId/confirmations/count',
    optionalAuthenticate,
    async (request, response, next) => {
      try {
        const { occurrenceId } = parseInput(confirmationOccurrenceIdParamsSchema, request.params);
        const result = await service.count(request.auth, occurrenceId);
        response.status(200).json(createSuccessResponse(request, result));
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
