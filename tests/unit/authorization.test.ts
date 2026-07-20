import { randomUUID } from 'node:crypto';

import express from 'express';
import { SignJWT } from 'jose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { env } from '../../src/config/env.js';
import { signAccessToken } from '../../src/modules/auth/auth.security.js';
import type { AuthenticatedPrincipal } from '../../src/modules/auth/auth.types.js';
import { errorHandlerMiddleware } from '../../src/shared/middleware/error-handler.js';
import {
  authorizeMunicipality,
  authorizeOccurrenceOwner,
  createAuthenticate,
} from '../../src/shared/middleware/authorization.js';
import { InMemoryIdentityRepository, makeUser } from '../helpers/in-memory-identity-repository.js';

interface ErrorBody {
  error: { code: string };
}

function testApp(repository: InMemoryIdentityRepository) {
  const app = express();
  app.use((req, _res, next) => {
    req.requestId = randomUUID();
    req.log = { error() {}, warn() {} } as typeof req.log;
    next();
  });
  app.get('/protected', createAuthenticate(repository), (_req, res) => res.sendStatus(204));
  app.use(errorHandlerMiddleware);
  return app;
}

describe('middlewares de autorizacao', () => {
  it('distingue token invalido e expirado', async () => {
    const repository = new InMemoryIdentityRepository();
    const app = testApp(repository);
    const invalid = await request(app)
      .get('/protected')
      .set('authorization', 'Bearer nao-e-jwt')
      .expect(401);
    expect((invalid.body as ErrorBody).error.code).toBe('INVALID_ACCESS_TOKEN');

    const expired = await new SignJWT({
      role: 'CITIZEN',
      municipalityId: randomUUID(),
      sessionId: randomUUID(),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(randomUUID())
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET));
    const expiredResponse = await request(app)
      .get('/protected')
      .set('authorization', `Bearer ${expired}`)
      .expect(401);
    expect((expiredResponse.body as ErrorBody).error.code).toBe('ACCESS_TOKEN_EXPIRED');
  });

  it('nega imediatamente um usuario bloqueado mesmo com JWT valido', async () => {
    const repository = new InMemoryIdentityRepository();
    const user = makeUser({ status: 'BLOCKED', passwordHash: 'irrelevante' });
    const sessionId = randomUUID();
    repository.addUser(user);
    await repository.createRefreshToken({
      sessionId,
      userId: user.id,
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 60_000),
      ipAddress: null,
      userAgent: null,
    });
    const token = await signAccessToken(user, sessionId);
    const response = await request(testApp(repository))
      .get('/protected')
      .set('authorization', `Bearer ${token}`)
      .expect(403);
    expect((response.body as ErrorBody).error.code).toBe('USER_BLOCKED');
  });

  it('isola municipio para cidadao e permite moderador global', async () => {
    const ownMunicipality = randomUUID();
    const otherMunicipality = randomUUID();
    const citizen: AuthenticatedPrincipal = {
      sub: randomUUID(),
      role: 'CITIZEN',
      municipalityId: ownMunicipality,
      sessionId: randomUUID(),
    };
    const moderator: AuthenticatedPrincipal = { ...citizen, role: 'MODERATOR' };
    const app = express();
    app.use((req, _res, next) => {
      req.requestId = randomUUID();
      req.log = { error() {}, warn() {} } as typeof req.log;
      req.auth = req.get('x-role') === 'moderator' ? moderator : citizen;
      next();
    });
    app.get(
      '/municipalities/:municipalityId',
      authorizeMunicipality((req) => req.params.municipalityId),
      (_req, res) => res.sendStatus(204),
    );
    app.use(errorHandlerMiddleware);

    await request(app).get(`/municipalities/${ownMunicipality}`).expect(204);
    const denied = await request(app).get(`/municipalities/${otherMunicipality}`).expect(403);
    expect((denied.body as ErrorBody).error.code).toBe('MUNICIPALITY_FORBIDDEN');
    await request(app)
      .get(`/municipalities/${otherMunicipality}`)
      .set('x-role', 'moderator')
      .expect(204);
  });

  it('autoriza proprietario e recusa outro usuario', async () => {
    const ownerId = randomUUID();
    const app = express();
    app.use((req, _res, next) => {
      req.requestId = randomUUID();
      req.log = { error() {}, warn() {} } as typeof req.log;
      req.auth = {
        sub: req.get('x-user-id') ?? randomUUID(),
        role: 'CITIZEN',
        municipalityId: randomUUID(),
        sessionId: randomUUID(),
      };
      next();
    });
    app.delete(
      '/occurrence',
      authorizeOccurrenceOwner(() => ownerId),
      (_req, res) => res.sendStatus(204),
    );
    app.use(errorHandlerMiddleware);

    await request(app).delete('/occurrence').set('x-user-id', ownerId).expect(204);
    const denied = await request(app)
      .delete('/occurrence')
      .set('x-user-id', randomUUID())
      .expect(403);
    expect((denied.body as ErrorBody).error.code).toBe('OWNER_FORBIDDEN');
  });
});
