import type { CookieOptions, Request, Response } from 'express';
import { Router } from 'express';

import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createSuccessResponse } from '../../shared/http/responses.js';
import { createAuthenticate } from '../../shared/middleware/authorization.js';
import { parseInput } from '../../shared/validation/parse.js';
import { changePasswordSchema, loginSchema, registerSchema } from './auth.schemas.js';
import { DefaultAuthService, type AuthService } from './auth.service.js';
import type { RequestContext, SessionTokens } from './auth.types.js';
import { PostgresIdentityRepository, type IdentityRepository } from './identity.repository.js';

export const refreshCookieName = 'ta_na_rua_refresh';

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/v1/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

function requestContext(request: Request): RequestContext {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  };
}

function readRefreshCookie(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[refreshCookieName];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function sessionResponse(tokens: SessionTokens) {
  return {
    accessToken: tokens.accessToken,
    tokenType: 'Bearer' as const,
    expiresIn: tokens.accessTokenExpiresIn,
  };
}

export interface AuthRouterOptions {
  repository?: IdentityRepository;
  service?: AuthService;
}

export function createAuthRouter(options: AuthRouterOptions = {}): Router {
  const repository = options.repository ?? new PostgresIdentityRepository();
  const service = options.service ?? new DefaultAuthService(repository);
  const authenticate = createAuthenticate(repository);
  const router = Router();

  router.post('/register', async (request, response, next) => {
    try {
      const user = await service.register(parseInput(registerSchema, request.body));
      response.status(201).json(createSuccessResponse(request, { user }));
    } catch (error) {
      next(error);
    }
  });

  router.post('/login', async (request, response, next) => {
    try {
      const session = await service.login(
        parseInput(loginSchema, request.body),
        requestContext(request),
      );
      response.cookie(refreshCookieName, session.refreshToken, refreshCookieOptions);
      response.status(200).json(
        createSuccessResponse(request, {
          ...sessionResponse(session),
          user: session.user,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post('/refresh', async (request, response, next) => {
    try {
      const refreshToken = readRefreshCookie(request);
      if (refreshToken === undefined) {
        throw new AppError(401, 'REFRESH_TOKEN_REQUIRED', 'O refresh token e obrigatorio.');
      }
      const session = await service.refresh(refreshToken, requestContext(request));
      response.cookie(refreshCookieName, session.refreshToken, refreshCookieOptions);
      response.status(200).json(
        createSuccessResponse(request, {
          ...sessionResponse(session),
          user: session.user,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', async (request, response, next) => {
    try {
      await service.logout(readRefreshCookie(request));
      response.clearCookie(refreshCookieName, refreshCookieOptions);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', authenticate, async (request, response, next) => {
    try {
      const user = await service.me(request.auth!);
      response.status(200).json(createSuccessResponse(request, { user }));
    } catch (error) {
      next(error);
    }
  });

  router.post('/change-password', authenticate, async (request, response, next) => {
    try {
      await service.changePassword(
        request.auth!,
        parseInput(changePasswordSchema, request.body),
        requestContext(request),
      );
      response.clearCookie(refreshCookieName, refreshCookieOptions);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function clearRefreshCookie(response: Response): void {
  response.clearCookie(refreshCookieName, refreshCookieOptions);
}
