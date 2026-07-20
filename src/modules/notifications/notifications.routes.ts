import { Router } from 'express';

import { createSuccessResponse } from '../../shared/http/responses.js';
import { createAuthenticate } from '../../shared/middleware/authorization.js';
import { parseInput } from '../../shared/validation/parse.js';
import {
  PostgresIdentityRepository,
  type IdentityRepository,
} from '../auth/identity.repository.js';
import { PostgresNotificationsRepository } from './notifications.repository.js';
import {
  notificationIdParamsSchema,
  notificationListQuerySchema,
} from './notifications.schemas.js';
import { DefaultNotificationsService } from './notifications.service.js';
import type { NotificationsService } from './notifications.types.js';

export interface NotificationsRouterOptions {
  identityRepository?: IdentityRepository;
  service?: NotificationsService;
}

export function createNotificationsRouter(options: NotificationsRouterOptions = {}): Router {
  const identityRepository = options.identityRepository ?? new PostgresIdentityRepository();
  const service =
    options.service ?? new DefaultNotificationsService(new PostgresNotificationsRepository());
  const router = Router();

  router.use(createAuthenticate(identityRepository));

  router.get('/', async (request, response, next) => {
    try {
      const result = await service.list(
        request.auth!.sub,
        parseInput(notificationListQuerySchema, request.query),
      );
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get('/unread-count', async (request, response, next) => {
    try {
      const result = await service.unreadCount(request.auth!.sub);
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/read-all', async (request, response, next) => {
    try {
      const result = await service.markAllRead(request.auth!.sub);
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id/read', async (request, response, next) => {
    try {
      const { id } = parseInput(notificationIdParamsSchema, request.params);
      const result = await service.markRead(request.auth!.sub, id);
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
