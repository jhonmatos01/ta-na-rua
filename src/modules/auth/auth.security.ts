import { createHash, randomBytes, randomUUID } from 'node:crypto';

import argon2 from 'argon2';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';

import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthenticatedPrincipal, UserRecord } from './auth.types.js';

const accessTokenSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export async function hashPassword(password: string): Promise<string> {
  const encoded: unknown = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  if (typeof encoded !== 'string') {
    throw new Error('O Argon2 nao retornou um hash codificado.');
  }
  return encoded;
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function createOpaqueRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function signAccessToken(user: UserRecord, sessionId: string): Promise<string> {
  return new SignJWT({
    role: user.role,
    municipalityId: user.municipalityId,
    sessionId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(accessTokenSecret);
}

export async function verifyAccessToken(token: string): Promise<AuthenticatedPrincipal> {
  try {
    const { payload } = await jwtVerify(token, accessTokenSecret, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      algorithms: ['HS256'],
    });
    const { sub, role, municipalityId, sessionId } = payload;

    if (
      typeof sub !== 'string' ||
      !['CITIZEN', 'CITY_OPERATOR', 'MODERATOR', 'ADMIN'].includes(String(role)) ||
      (municipalityId !== null && typeof municipalityId !== 'string') ||
      typeof sessionId !== 'string'
    ) {
      throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'O token de acesso e invalido.');
    }

    return {
      sub,
      role: role as AuthenticatedPrincipal['role'],
      municipalityId: municipalityId ?? null,
      sessionId,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof joseErrors.JWTExpired) {
      throw new AppError(401, 'ACCESS_TOKEN_EXPIRED', 'O token de acesso expirou.');
    }

    throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'O token de acesso e invalido.');
  }
}
