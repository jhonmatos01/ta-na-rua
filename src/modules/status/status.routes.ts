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
import { PostgresStatusRepository } from './status.repository.js';
import {
  statusOccurrenceIdParamsSchema,
  updateOccurrenceAssignmentSchema,
  updateOccurrenceStatusSchema,
} from './status.schemas.js';
import { DefaultStatusService } from './status.service.js';
import type { StatusRepository, StatusService } from './status.types.js';

function requestContext(request: Request): RequestContext {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  };
}

export interface StatusRouterOptions {
  identityRepository?: IdentityRepository;
  repository?: StatusRepository;
  priorityService?: PriorityService;
  service?: StatusService;
}

export function createStatusRouter(options: StatusRouterOptions = {}): Router {
  const identityRepository = options.identityRepository ?? new PostgresIdentityRepository();
  const repository = options.repository ?? new PostgresStatusRepository();
  const priorityService = options.priorityService ?? new DefaultPriorityService();
  const service = options.service ?? new DefaultStatusService(repository, priorityService);
  const authenticate = createAuthenticate(identityRepository);
  const optionalAuthenticate = createOptionalAuthenticate(identityRepository);
  const operational = authorizeRoles('CITY_OPERATOR', 'MODERATOR', 'ADMIN');
  const router = Router();

  router.patch(
    '/:occurrenceId/status',
    authenticate,
    operational,
    async (request, response, next) => {
      try {
        const { occurrenceId } = parseInput(statusOccurrenceIdParamsSchema, request.params);
        const result = await service.transition(
          request.auth!,
          occurrenceId,
          parseInput(updateOccurrenceStatusSchema, request.body),
          requestContext(request),
        );
        response.status(200).json(createSuccessResponse(request, result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    '/:occurrenceId/assignment',
    authenticate,
    operational,
    async (request, response, next) => {
      try {
        const { occurrenceId } = parseInput(statusOccurrenceIdParamsSchema, request.params);
        const result = await service.assign(
          request.auth!,
          occurrenceId,
          parseInput(updateOccurrenceAssignmentSchema, request.body),
          requestContext(request),
        );
        response.status(200).json(createSuccessResponse(request, result));
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/:occurrenceId/status-history',
    optionalAuthenticate,
    async (request, response, next) => {
      try {
        const { occurrenceId } = parseInput(statusOccurrenceIdParamsSchema, request.params);
        const result = await service.history(request.auth, occurrenceId);
        response.status(200).json(createSuccessResponse(request, result));
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
