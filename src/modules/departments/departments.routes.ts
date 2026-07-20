import type { Request } from 'express';
import { Router } from 'express';

import { createSuccessResponse } from '../../shared/http/responses.js';
import { authorizeRoles, createAuthenticate } from '../../shared/middleware/authorization.js';
import { parseInput } from '../../shared/validation/parse.js';
import type { RequestContext } from '../auth/auth.types.js';
import {
  PostgresIdentityRepository,
  type IdentityRepository,
} from '../auth/identity.repository.js';
import { PostgresDepartmentsRepository } from './departments.repository.js';
import {
  createDepartmentSchema,
  departmentIdParamsSchema,
  listDepartmentsQuerySchema,
  updateDepartmentActiveSchema,
  updateDepartmentSchema,
} from './departments.schemas.js';
import { DefaultDepartmentsService } from './departments.service.js';
import type { DepartmentsRepository, DepartmentsService } from './departments.types.js';

function requestContext(request: Request): RequestContext {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  };
}

export interface DepartmentsRouterOptions {
  identityRepository?: IdentityRepository;
  repository?: DepartmentsRepository;
  service?: DepartmentsService;
}

export function createDepartmentsRouter(options: DepartmentsRouterOptions = {}): Router {
  const identityRepository = options.identityRepository ?? new PostgresIdentityRepository();
  const repository = options.repository ?? new PostgresDepartmentsRepository();
  const service = options.service ?? new DefaultDepartmentsService(repository);
  const router = Router();

  router.use(
    createAuthenticate(identityRepository),
    authorizeRoles('CITY_OPERATOR', 'MODERATOR', 'ADMIN'),
  );

  router.get('/', async (request, response, next) => {
    try {
      const result = await service.list(
        request.auth!,
        parseInput(listDepartmentsQuerySchema, request.query),
      );
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (request, response, next) => {
    try {
      const result = await service.create(
        request.auth!,
        parseInput(createDepartmentSchema, request.body),
        requestContext(request),
      );
      response.status(201).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get('/:departmentId', async (request, response, next) => {
    try {
      const { departmentId } = parseInput(departmentIdParamsSchema, request.params);
      response
        .status(200)
        .json(createSuccessResponse(request, await service.get(request.auth!, departmentId)));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:departmentId', async (request, response, next) => {
    try {
      const { departmentId } = parseInput(departmentIdParamsSchema, request.params);
      const result = await service.update(
        request.auth!,
        departmentId,
        parseInput(updateDepartmentSchema, request.body),
        requestContext(request),
      );
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:departmentId/active', async (request, response, next) => {
    try {
      const { departmentId } = parseInput(departmentIdParamsSchema, request.params);
      const { active } = parseInput(updateDepartmentActiveSchema, request.body);
      const result = await service.setActive(
        request.auth!,
        departmentId,
        active,
        requestContext(request),
      );
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:departmentId', async (request, response, next) => {
    try {
      const { departmentId } = parseInput(departmentIdParamsSchema, request.params);
      await service.remove(request.auth!, departmentId, requestContext(request));
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
