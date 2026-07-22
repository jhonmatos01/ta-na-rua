import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/modules/auth/auth.security.js';
import type { ReverseGeocodingService } from '../../src/modules/geocoding/geocoding.types.js';
import { InMemoryApiRateLimiter } from '../../src/shared/middleware/api-rate-limit.js';
import { InMemoryIdentityRepository, makeUser } from '../helpers/in-memory-identity-repository.js';

async function authenticatedApp(service: ReverseGeocodingService) {
  const repository = new InMemoryIdentityRepository();
  const user = makeUser({ role: 'CITIZEN', status: 'ACTIVE', deletedAt: null });
  const sessionId = randomUUID();
  repository.addUser(user);
  await repository.createRefreshToken({
    sessionId,
    userId: user.id,
    tokenHash: randomUUID(),
    expiresAt: new Date(Date.now() + 60_000),
    ipAddress: null,
    userAgent: null,
  });
  return {
    app: createApp({
      identityRepository: repository,
      geocodingService: service,
      geocodingRateLimiter: new InMemoryApiRateLimiter(10, 60),
    }),
    token: await signAccessToken(user, sessionId),
  };
}

describe('rotas HTTP de geocodificacao', () => {
  const service: ReverseGeocodingService = {
    reverse: () =>
      Promise.resolve({
        street: 'Rua das Flores',
        houseNumber: '123',
        streetAddress: 'Rua das Flores, 123',
        neighborhood: 'Pituba',
        city: 'Salvador',
        state: 'Bahia',
        postcode: '41830-000',
        countryCode: 'BR',
        formattedAddress: 'Rua das Flores, 123 · Pituba · Salvador · Bahia',
        provider: {
          name: 'OpenStreetMap',
          text: '© OpenStreetMap contributors',
          url: 'https://www.openstreetmap.org/copyright',
        },
      }),
  };

  it('exige autenticacao antes de receber coordenadas', async () => {
    await request(createApp({ geocodingService: service }))
      .post('/api/v1/geocoding/reverse')
      .send({ latitude: -12.7953, longitude: -38.3955 })
      .expect(401);
  });

  it('retorna somente o endereco sanitizado para entrada valida', async () => {
    const { app, token } = await authenticatedApp(service);
    const response = await request(app)
      .post('/api/v1/geocoding/reverse')
      .set('authorization', `Bearer ${token}`)
      .send({ latitude: -12.7953, longitude: -38.3955 })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        address: {
          streetAddress: 'Rua das Flores, 123',
          neighborhood: 'Pituba',
          provider: { name: 'OpenStreetMap' },
        },
      },
    });
  });

  it('rejeita coordenadas invalidas sem chamar o provedor', async () => {
    const { app, token } = await authenticatedApp(service);
    await request(app)
      .post('/api/v1/geocoding/reverse')
      .set('authorization', `Bearer ${token}`)
      .send({ latitude: 91, longitude: -38.3955 })
      .expect(422);
  });
});
