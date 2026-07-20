import type { Request, RequestHandler } from 'express';

import type { IdentityRepository } from '../../modules/auth/identity.repository.js';
import type { UserRole } from '../../modules/auth/auth.types.js';
import { AppError } from '../errors/app-error.js';
import { verifyAccessToken } from '../../modules/auth/auth.security.js';

function requiredPrincipal(request: Request) {
  if (request.auth === undefined) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Autenticacao obrigatoria.');
  }
  return request.auth;
}

export function createAuthenticate(repository: IdentityRepository): RequestHandler {
  return async (request, _response, next) => {
    try {
      const authorization = request.headers.authorization;
      if (authorization === undefined) {
        throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Autenticacao obrigatoria.');
      }
      const match = /^Bearer\s+(\S+)$/iu.exec(authorization);
      if (match?.[1] === undefined) {
        throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'O token de acesso e invalido.');
      }

      const principal = await verifyAccessToken(match[1]);
      const user = await repository.findUserById(principal.sub);
      if (user === null || user.status === 'DELETED' || user.deletedAt !== null) {
        throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'O token de acesso e invalido.');
      }
      if (user.status === 'BLOCKED') {
        throw new AppError(403, 'USER_BLOCKED', 'Este usuario esta bloqueado.');
      }
      if (user.status !== 'ACTIVE') {
        throw new AppError(403, 'USER_NOT_ACTIVE', 'Este usuario nao esta ativo.');
      }
      if (!(await repository.isSessionActive(user.id, principal.sessionId, new Date()))) {
        throw new AppError(401, 'SESSION_REVOKED', 'A sessao foi revogada ou expirou.');
      }

      request.auth = {
        ...principal,
        role: user.role,
        municipalityId: user.municipalityId,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createOptionalAuthenticate(repository: IdentityRepository): RequestHandler {
  const authenticate = createAuthenticate(repository);
  return (request, response, next) => {
    if (request.headers.authorization === undefined) {
      next();
      return;
    }
    authenticate(request, response, next);
  };
}

export function authorizeRoles(...roles: readonly UserRole[]): RequestHandler {
  return (request, _response, next) => {
    try {
      const principal = requiredPrincipal(request);
      if (!roles.includes(principal.role)) {
        throw new AppError(403, 'FORBIDDEN', 'Seu perfil nao possui permissao para esta acao.');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function authorizeMunicipality(
  resolveMunicipalityId: (request: Request) => string | null | undefined,
): RequestHandler {
  return (request, _response, next) => {
    try {
      const principal = requiredPrincipal(request);
      const targetMunicipalityId = resolveMunicipalityId(request);
      const canCrossMunicipalities = principal.role === 'ADMIN' || principal.role === 'MODERATOR';
      if (
        !canCrossMunicipalities &&
        (targetMunicipalityId === undefined ||
          targetMunicipalityId === null ||
          principal.municipalityId !== targetMunicipalityId)
      ) {
        throw new AppError(403, 'MUNICIPALITY_FORBIDDEN', 'Acesso negado para este municipio.');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function authorizeOccurrenceOwner(
  resolveOwnerId: (request: Request) => Promise<string | null> | string | null,
): RequestHandler {
  return async (request, _response, next) => {
    try {
      const principal = requiredPrincipal(request);
      if (principal.role === 'ADMIN' || principal.role === 'MODERATOR') {
        next();
        return;
      }
      const ownerId = await resolveOwnerId(request);
      if (ownerId === null || ownerId !== principal.sub) {
        throw new AppError(
          403,
          'OWNER_FORBIDDEN',
          'Somente o proprietario pode realizar esta acao.',
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
