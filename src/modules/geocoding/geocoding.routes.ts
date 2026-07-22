import type { RequestHandler } from 'express';
import { Router } from 'express';

import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createSuccessResponse } from '../../shared/http/responses.js';
import {
  InMemoryApiRateLimiter,
  type ApiRateLimiter,
} from '../../shared/middleware/api-rate-limit.js';
import { createAuthenticate } from '../../shared/middleware/authorization.js';
import { parseInput } from '../../shared/validation/parse.js';
import {
  PostgresIdentityRepository,
  type IdentityRepository,
} from '../auth/identity.repository.js';
import { reverseGeocodingInputSchema } from './geocoding.schemas.js';
import { DefaultReverseGeocodingService } from './geocoding.service.js';
import type { ReverseGeocodingService } from './geocoding.types.js';

export interface GeocodingRouterOptions {
  identityRepository?: IdentityRepository;
  service?: ReverseGeocodingService;
  rateLimiter?: ApiRateLimiter;
}

function createGeocodingRateLimit(limiter: ApiRateLimiter): RequestHandler {
  return (request, response, next) => {
    const result = limiter.consume(request.auth?.sub ?? request.ip ?? 'unknown');
    response.setHeader('X-Geocoding-RateLimit-Limit', String(result.limit));
    response.setHeader('X-Geocoding-RateLimit-Remaining', String(result.remaining));
    if (result.allowed) {
      next();
      return;
    }
    response.setHeader('Retry-After', String(result.retryAfterSeconds));
    next(new AppError(429, 'GEOCODING_RATE_LIMITED', 'Aguarde antes de buscar outro endereco.'));
  };
}

export function createGeocodingRouter(options: GeocodingRouterOptions = {}): Router {
  const identityRepository = options.identityRepository ?? new PostgresIdentityRepository();
  const service = options.service ?? new DefaultReverseGeocodingService();
  const limiter =
    options.rateLimiter ??
    new InMemoryApiRateLimiter(
      env.GEOCODING_RATE_LIMIT_MAX,
      env.GEOCODING_RATE_LIMIT_WINDOW_SECONDS,
    );
  const authenticate = createAuthenticate(identityRepository);
  const router = Router();

  router.post(
    '/reverse',
    authenticate,
    createGeocodingRateLimit(limiter),
    async (request, response, next) => {
      try {
        const address = await service.reverse(
          parseInput(reverseGeocodingInputSchema, request.body),
        );
        response.status(200).json(createSuccessResponse(request, { address }));
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
