import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import path from 'node:path';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { openApiDocument } from './docs/openapi.js';
import { createAiRouter, type AiRouterOptions } from './modules/ai/ai.routes.js';
import { DefaultAiAnalysisService } from './modules/ai/ai.service.js';
import { createHealthRouter, type DatabaseHealthCheck } from './modules/health/health.routes.js';
import { createAuthRouter, type AuthRouterOptions } from './modules/auth/auth.routes.js';
import type { IdentityRepository } from './modules/auth/identity.repository.js';
import {
  createConfirmationsRouter,
  type ConfirmationsRouterOptions,
} from './modules/confirmations/confirmations.routes.js';
import {
  createDepartmentsRouter,
  type DepartmentsRouterOptions,
} from './modules/departments/departments.routes.js';
import {
  createDashboardRouter,
  type DashboardRouterOptions,
} from './modules/dashboard/dashboard.routes.js';
import {
  createEvaluationsRouter,
  type EvaluationsRouterOptions,
} from './modules/evaluations/evaluations.routes.js';
import {
  createGeocodingRouter,
  type GeocodingRouterOptions,
} from './modules/geocoding/geocoding.routes.js';
import {
  createOccurrencesRouter,
  type OccurrencesRouterOptions,
} from './modules/occurrences/occurrences.routes.js';
import {
  createNotificationsRouter,
  type NotificationsRouterOptions,
} from './modules/notifications/notifications.routes.js';
import {
  createWebhooksRouter,
  type WebhooksRouterOptions,
} from './modules/webhooks/webhooks.routes.js';
import { createStatusRouter, type StatusRouterOptions } from './modules/status/status.routes.js';
import {
  createAdminUsersRouter,
  createUsersRouter,
  type UsersRouterOptions,
} from './modules/users/users.routes.js';
import { errorHandlerMiddleware } from './shared/middleware/error-handler.js';
import { notFoundMiddleware } from './shared/middleware/not-found.js';
import { requestIdMiddleware } from './shared/middleware/request-id.js';
import { requestLoggerMiddleware } from './shared/middleware/request-logger.js';
import {
  createApiRateLimitMiddleware,
  type ApiRateLimiter,
} from './shared/middleware/api-rate-limit.js';

export interface AppOptions {
  apiRateLimiter?: ApiRateLimiter;
  databaseHealthCheck?: DatabaseHealthCheck;
  identityRepository?: IdentityRepository;
  authService?: AuthRouterOptions['service'];
  usersService?: UsersRouterOptions['service'];
  occurrencesService?: OccurrencesRouterOptions['service'];
  occurrenceRepository?: OccurrencesRouterOptions['occurrenceRepository'];
  imageStorage?: OccurrencesRouterOptions['storage'];
  confirmationsService?: ConfirmationsRouterOptions['service'];
  confirmationsRepository?: ConfirmationsRouterOptions['repository'];
  priorityService?: ConfirmationsRouterOptions['priorityService'];
  departmentsService?: DepartmentsRouterOptions['service'];
  departmentsRepository?: DepartmentsRouterOptions['repository'];
  dashboardService?: DashboardRouterOptions['service'];
  statusService?: StatusRouterOptions['service'];
  statusRepository?: StatusRouterOptions['repository'];
  evaluationsService?: EvaluationsRouterOptions['service'];
  evaluationsRepository?: EvaluationsRouterOptions['repository'];
  aiService?: AiRouterOptions['service'];
  notificationsService?: NotificationsRouterOptions['service'];
  webhooksService?: WebhooksRouterOptions['service'];
  geocodingService?: GeocodingRouterOptions['service'];
  geocodingRateLimiter?: GeocodingRouterOptions['rateLimiter'];
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('json escape', true);
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use('/api', createApiRateLimitMiddleware(options.apiRateLimiter));
  app.use(
    express.json({
      limit: env.JSON_BODY_LIMIT,
      type: ['application/json', 'application/*+json'],
      verify: (request, _response, buffer) => {
        (request as typeof request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
      },
    }),
  );
  app.use(cookieParser());

  if (env.STORAGE_PROVIDER === 'local') {
    app.use(
      '/uploads',
      express.static(path.resolve(env.STORAGE_LOCAL_DIRECTORY), { index: false }),
    );
  }

  app.get('/docs/openapi.json', (_request, response) => {
    response.status(200).json(openApiDocument);
  });
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'Ta na Rua! API',
      swaggerOptions: {
        persistAuthorization: false,
      },
    }),
  );

  const healthRouter =
    options.databaseHealthCheck === undefined
      ? createHealthRouter()
      : createHealthRouter(options.databaseHealthCheck);
  app.use('/health', healthRouter);

  const authOptions: AuthRouterOptions = {
    ...(options.identityRepository === undefined ? {} : { repository: options.identityRepository }),
    ...(options.authService === undefined ? {} : { service: options.authService }),
  };
  app.use('/api/v1/auth', createAuthRouter(authOptions));
  app.use(
    '/api/v1/geocoding',
    createGeocodingRouter({
      ...(options.identityRepository === undefined
        ? {}
        : { identityRepository: options.identityRepository }),
      ...(options.geocodingService === undefined ? {} : { service: options.geocodingService }),
      ...(options.geocodingRateLimiter === undefined
        ? {}
        : { rateLimiter: options.geocodingRateLimiter }),
    }),
  );
  const usersOptions: UsersRouterOptions = {
    ...(options.identityRepository === undefined ? {} : { repository: options.identityRepository }),
    ...(options.usersService === undefined ? {} : { service: options.usersService }),
  };
  app.use('/api/v1/users', createUsersRouter(usersOptions));
  app.use('/api/v1/admin', createAdminUsersRouter(usersOptions));
  const aiService = options.aiService ?? new DefaultAiAnalysisService();
  const occurrencesOptions: OccurrencesRouterOptions = {
    ...(options.identityRepository === undefined
      ? {}
      : { identityRepository: options.identityRepository }),
    ...(options.occurrenceRepository === undefined
      ? {}
      : { occurrenceRepository: options.occurrenceRepository }),
    ...(options.imageStorage === undefined ? {} : { storage: options.imageStorage }),
    aiProcessor: aiService,
    ...(options.occurrencesService === undefined ? {} : { service: options.occurrencesService }),
  };
  app.use('/api/v1/occurrences', createOccurrencesRouter(occurrencesOptions));
  app.use('/api/v1/internal/ai', createAiRouter({ service: aiService }));
  const confirmationsOptions: ConfirmationsRouterOptions = {
    ...(options.identityRepository === undefined
      ? {}
      : { identityRepository: options.identityRepository }),
    ...(options.confirmationsRepository === undefined
      ? {}
      : { repository: options.confirmationsRepository }),
    ...(options.priorityService === undefined ? {} : { priorityService: options.priorityService }),
    ...(options.confirmationsService === undefined
      ? {}
      : { service: options.confirmationsService }),
  };
  app.use('/api/v1/occurrences', createConfirmationsRouter(confirmationsOptions));
  const statusOptions: StatusRouterOptions = {
    ...(options.identityRepository === undefined
      ? {}
      : { identityRepository: options.identityRepository }),
    ...(options.statusRepository === undefined ? {} : { repository: options.statusRepository }),
    ...(options.priorityService === undefined ? {} : { priorityService: options.priorityService }),
    ...(options.statusService === undefined ? {} : { service: options.statusService }),
  };
  app.use('/api/v1/occurrences', createStatusRouter(statusOptions));
  const evaluationsOptions: EvaluationsRouterOptions = {
    ...(options.identityRepository === undefined
      ? {}
      : { identityRepository: options.identityRepository }),
    ...(options.evaluationsRepository === undefined
      ? {}
      : { repository: options.evaluationsRepository }),
    ...(options.priorityService === undefined ? {} : { priorityService: options.priorityService }),
    ...(options.evaluationsService === undefined ? {} : { service: options.evaluationsService }),
  };
  app.use('/api/v1/occurrences', createEvaluationsRouter(evaluationsOptions));
  const departmentsOptions: DepartmentsRouterOptions = {
    ...(options.identityRepository === undefined
      ? {}
      : { identityRepository: options.identityRepository }),
    ...(options.departmentsRepository === undefined
      ? {}
      : { repository: options.departmentsRepository }),
    ...(options.departmentsService === undefined ? {} : { service: options.departmentsService }),
  };
  app.use('/api/v1/departments', createDepartmentsRouter(departmentsOptions));
  app.use(
    '/api/v1/dashboard',
    createDashboardRouter({
      ...(options.identityRepository === undefined
        ? {}
        : { identityRepository: options.identityRepository }),
      ...(options.dashboardService === undefined ? {} : { service: options.dashboardService }),
    }),
  );
  app.use(
    '/api/v1/notifications',
    createNotificationsRouter({
      ...(options.identityRepository === undefined
        ? {}
        : { identityRepository: options.identityRepository }),
      ...(options.notificationsService === undefined
        ? {}
        : { service: options.notificationsService }),
    }),
  );
  app.use(
    '/api/v1/webhooks',
    createWebhooksRouter({
      ...(options.webhooksService === undefined ? {} : { service: options.webhooksService }),
    }),
  );

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
