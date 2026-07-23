import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { signAccessToken } from '../../src/modules/auth/auth.security.js';
import type { OccurrencesService } from '../../src/modules/occurrences/occurrences.service.js';
import { InMemoryIdentityRepository, makeUser } from '../helpers/in-memory-identity-repository.js';

interface ErrorBody {
  error: { code: string };
}

interface OccurrenceListBody {
  success: boolean;
  data: { occurrences: Array<{ distanceMeters?: number }> };
  meta: { page: number; limit: number; total: number; totalPages: number };
}

function mockService(): OccurrencesService {
  return {
    create: () => Promise.resolve({ id: randomUUID(), status: 'PENDING_REVIEW' }),
    list: (_principal, query) =>
      Promise.resolve({
        occurrences: [{ id: randomUUID() }],
        pagination: { page: query.page, limit: query.limit, total: 21, totalPages: 2 },
      }),
    nearby: (_principal, query) =>
      Promise.resolve({
        occurrences: [{ distanceMeters: 12 }],
        pagination: { page: query.page, limit: query.limit, total: 1, totalPages: 1 },
      }),
    map: () => Promise.resolve({ points: [] }),
    mine: (_principal, query) =>
      Promise.resolve({
        occurrences: [],
        pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
      }),
    confirmedByMe: (_principal, query) =>
      Promise.resolve({
        occurrences: [{ id: randomUUID() }],
        pagination: { page: query.page, limit: query.limit, total: 1, totalPages: 1 },
      }),
    get: (_principal, occurrenceId) => Promise.resolve({ id: occurrenceId }),
    update: (_principal, occurrenceId, input) => Promise.resolve({ id: occurrenceId, ...input }),
    delete: () => Promise.resolve(),
    addImage: () => Promise.resolve({ id: randomUUID(), moderationStatus: 'PENDING' }),
    timeline: () => Promise.resolve({ timeline: [] }),
  };
}

async function authenticatedApp(role: 'CITIZEN' | 'MODERATOR' = 'CITIZEN') {
  const repository = new InMemoryIdentityRepository();
  const user = makeUser({ role, status: 'ACTIVE', deletedAt: null });
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
    app: createApp({ identityRepository: repository, occurrencesService: mockService() }),
    token: await signAccessToken(user, sessionId),
  };
}

describe('rotas HTTP de ocorrencias', () => {
  it('lista publicamente com paginacao no meta', async () => {
    const app = createApp({ occurrencesService: mockService() });
    const response = await request(app).get('/api/v1/occurrences?page=2&limit=20').expect(200);
    const body = response.body as OccurrenceListBody;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.occurrences)).toBe(true);
    expect(body.meta).toMatchObject({ page: 2, limit: 20, total: 21, totalPages: 2 });
  });

  it('resolve nearby, map, mine e confirmed-by-me antes da rota parametrizada', async () => {
    const { app, token } = await authenticatedApp();
    await request(app)
      .get('/api/v1/occurrences/nearby?latitude=-12.97&longitude=-38.5')
      .expect(200)
      .expect((response) => {
        const body = response.body as OccurrenceListBody;
        expect(body.data.occurrences[0]?.distanceMeters).toBe(12);
      });
    await request(app).get('/api/v1/occurrences/map').expect(200);
    await request(app)
      .get('/api/v1/occurrences/mine')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    await request(app)
      .get('/api/v1/occurrences/confirmed-by-me?page=1&limit=10')
      .set('authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as OccurrenceListBody;
        expect(body.meta).toMatchObject({ page: 1, limit: 10, total: 1, totalPages: 1 });
      });
    await request(app).get('/api/v1/occurrences/confirmed-by-me').expect(401);
  });

  it('exige autenticacao e imagem inicial na criacao', async () => {
    const { app, token } = await authenticatedApp();
    await request(app)
      .post('/api/v1/occurrences')
      .field('title', 'Buraco na via')
      .field('municipalityId', randomUUID())
      .field('latitude', '-12.97')
      .field('longitude', '-38.5')
      .expect(401)
      .expect((response) =>
        expect((response.body as ErrorBody).error.code).toBe('AUTHENTICATION_REQUIRED'),
      );
    await request(app)
      .post('/api/v1/occurrences')
      .set('authorization', `Bearer ${token}`)
      .field('title', 'Buraco na via')
      .field('municipalityId', randomUUID())
      .field('latitude', '-12.97')
      .field('longitude', '-38.5')
      .expect(422)
      .expect((response) => expect((response.body as ErrorBody).error.code).toBe('IMAGE_REQUIRED'));
  });

  it('aceita multipart valido e rejeita arquivo acima do limite', async () => {
    const { app, token } = await authenticatedApp();
    const fields = (test: request.Test) =>
      test
        .set('authorization', `Bearer ${token}`)
        .field('title', 'Buraco na via')
        .field('municipalityId', randomUUID())
        .field('latitude', '-12.97')
        .field('longitude', '-38.5');

    await fields(request(app).post('/api/v1/occurrences'))
      .attach('image', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'exemplo.png',
        contentType: 'image/png',
      })
      .expect(201);

    await fields(request(app).post('/api/v1/occurrences'))
      .attach('image', Buffer.alloc(env.MAX_IMAGE_SIZE_MB * 1024 * 1024 + 1), {
        filename: 'grande.png',
        contentType: 'image/png',
      })
      .expect(413)
      .expect((response) =>
        expect((response.body as ErrorBody).error.code).toBe('IMAGE_TOO_LARGE'),
      );
  });

  it('valida UUID, coordenadas e pagina maxima', async () => {
    const app = createApp({ occurrencesService: mockService() });
    await request(app).get('/api/v1/occurrences/nao-e-uuid').expect(422);
    await request(app).get('/api/v1/occurrences/nearby?latitude=91&longitude=-38.5').expect(422);
    await request(app).get('/api/v1/occurrences?limit=101').expect(422);
  });

  it('protege atualizacao, imagem adicional e exclusao por perfil', async () => {
    const occurrenceId = randomUUID();
    const citizen = await authenticatedApp();
    await request(citizen.app)
      .patch(`/api/v1/occurrences/${occurrenceId}`)
      .set('authorization', `Bearer ${citizen.token}`)
      .send({ title: 'Titulo atualizado' })
      .expect(200);
    await request(citizen.app)
      .post(`/api/v1/occurrences/${occurrenceId}/images`)
      .set('authorization', `Bearer ${citizen.token}`)
      .attach('image', Buffer.from([0xff, 0xd8, 0xff]), {
        filename: 'foto.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);
    await request(citizen.app)
      .delete(`/api/v1/occurrences/${occurrenceId}`)
      .set('authorization', `Bearer ${citizen.token}`)
      .expect(403);

    const moderator = await authenticatedApp('MODERATOR');
    await request(moderator.app)
      .delete(`/api/v1/occurrences/${occurrenceId}`)
      .set('authorization', `Bearer ${moderator.token}`)
      .expect(204);
  });
});
