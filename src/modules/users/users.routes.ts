import type { Request } from 'express';
import { Router } from 'express';

import { createSuccessResponse } from '../../shared/http/responses.js';
import { authorizeRoles, createAuthenticate } from '../../shared/middleware/authorization.js';
import { parseInput } from '../../shared/validation/parse.js';
import { clearRefreshCookie } from '../auth/auth.routes.js';
import type { RequestContext } from '../auth/auth.types.js';
import {
  PostgresIdentityRepository,
  type IdentityRepository,
} from '../auth/identity.repository.js';
import {
  listUsersQuerySchema,
  updateProfileSchema,
  updateRoleSchema,
  updateStatusSchema,
  userIdParamsSchema,
} from './users.schemas.js';
import { DefaultUsersService, type UsersService } from './users.service.js';

function requestContext(request: Request): RequestContext {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  };
}

export interface UsersRouterOptions {
  repository?: IdentityRepository;
  service?: UsersService;
}

export function createUsersRouter(options: UsersRouterOptions = {}): Router {
  const repository = options.repository ?? new PostgresIdentityRepository();
  const service = options.service ?? new DefaultUsersService(repository);
  const authenticate = createAuthenticate(repository);
  const router = Router();

  router.use(authenticate);

  router.get('/me', async (request, response, next) => {
    try {
      response
        .status(200)
        .json(createSuccessResponse(request, { user: await service.getMe(request.auth!) }));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/me', async (request, response, next) => {
    try {
      const user = await service.updateMe(
        request.auth!,
        parseInput(updateProfileSchema, request.body),
        requestContext(request),
      );
      response.status(200).json(createSuccessResponse(request, { user }));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/me', async (request, response, next) => {
    try {
      await service.deleteMe(request.auth!, requestContext(request));
      clearRefreshCookie(response);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createAdminUsersRouter(options: UsersRouterOptions = {}): Router {
  const repository = options.repository ?? new PostgresIdentityRepository();
  const service = options.service ?? new DefaultUsersService(repository);
  const authenticate = createAuthenticate(repository);
  const router = Router();

  router.use(authenticate, authorizeRoles('ADMIN'));

  router.get('/users', async (request, response, next) => {
    try {
      const result = await service.list(parseInput(listUsersQuerySchema, request.query));
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get('/users/:userId', async (request, response, next) => {
    try {
      const { userId } = parseInput(userIdParamsSchema, request.params);
      response
        .status(200)
        .json(createSuccessResponse(request, { user: await service.getById(userId) }));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/users/:userId/status', async (request, response, next) => {
    try {
      const { userId } = parseInput(userIdParamsSchema, request.params);
      const { status } = parseInput(updateStatusSchema, request.body);
      const user = await service.updateStatus(
        request.auth!,
        userId,
        status,
        requestContext(request),
      );
      response.status(200).json(createSuccessResponse(request, { user }));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/users/:userId/role', async (request, response, next) => {
    try {
      const { userId } = parseInput(userIdParamsSchema, request.params);
      const { role } = parseInput(updateRoleSchema, request.body);
      const user = await service.updateRole(request.auth!, userId, role, requestContext(request));
      response.status(200).json(createSuccessResponse(request, { user }));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
