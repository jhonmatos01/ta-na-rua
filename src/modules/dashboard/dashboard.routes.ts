import { Router } from 'express';

import { createSuccessResponse } from '../../shared/http/responses.js';
import { authorizeRoles, createAuthenticate } from '../../shared/middleware/authorization.js';
import { parseInput } from '../../shared/validation/parse.js';
import {
  PostgresIdentityRepository,
  type IdentityRepository,
} from '../auth/identity.repository.js';
import { PostgresDashboardRepository } from './dashboard.repository.js';
import {
  dashboardExportQuerySchema,
  dashboardQuerySchema,
  priorityRankingQuerySchema,
} from './dashboard.schemas.js';
import { DefaultDashboardService } from './dashboard.service.js';
import type { DashboardService } from './dashboard.types.js';

export interface DashboardRouterOptions {
  identityRepository?: IdentityRepository;
  service?: DashboardService;
}

export function createDashboardRouter(options: DashboardRouterOptions = {}): Router {
  const identityRepository = options.identityRepository ?? new PostgresIdentityRepository();
  const service = options.service ?? new DefaultDashboardService(new PostgresDashboardRepository());
  const router = Router();

  router.use(
    createAuthenticate(identityRepository),
    authorizeRoles('CITY_OPERATOR', 'MODERATOR', 'ADMIN'),
  );

  router.get('/summary', async (request, response, next) => {
    try {
      const result = await service.summary(
        request.auth!,
        parseInput(dashboardQuerySchema, request.query),
      );
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get('/by-category', async (request, response, next) => {
    try {
      const result = await service.byCategory(
        request.auth!,
        parseInput(dashboardQuerySchema, request.query),
      );
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get('/by-neighborhood', async (request, response, next) => {
    try {
      const result = await service.byNeighborhood(
        request.auth!,
        parseInput(dashboardQuerySchema, request.query),
      );
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get('/by-status', async (request, response, next) => {
    try {
      const result = await service.byStatus(
        request.auth!,
        parseInput(dashboardQuerySchema, request.query),
      );
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get('/priority-ranking', async (request, response, next) => {
    try {
      const result = await service.priorityRanking(
        request.auth!,
        parseInput(priorityRankingQuerySchema, request.query),
      );
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get('/resolution-time', async (request, response, next) => {
    try {
      const result = await service.resolutionTime(
        request.auth!,
        parseInput(dashboardQuerySchema, request.query),
      );
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get('/heatmap', async (request, response, next) => {
    try {
      const result = await service.heatmap(
        request.auth!,
        parseInput(dashboardQuerySchema, request.query),
      );
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get('/export', async (request, response, next) => {
    try {
      const result = await service.export(
        request.auth!,
        parseInput(dashboardExportQuerySchema, request.query),
      );
      response
        .status(200)
        .type('text/csv')
        .setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
        .setHeader('X-Export-Row-Count', String(result.rowCount))
        .setHeader('X-Export-Limit', String(result.limit))
        .setHeader('X-Export-Truncated', String(result.truncated))
        .send(result.content);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
