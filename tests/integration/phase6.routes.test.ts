import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/modules/auth/auth.security.js';
import type { UserRole } from '../../src/modules/auth/auth.types.js';
import type { EvaluationsService } from '../../src/modules/evaluations/evaluations.types.js';
import { InMemoryIdentityRepository, makeUser } from '../helpers/in-memory-identity-repository.js';

interface ErrorBody {
  error: { code: string };
}

class FakeEvaluationsService implements EvaluationsService {
  public getMine(): Promise<unknown> {
    return Promise.resolve({
      evaluation: null,
      canCreate: false,
      canEdit: false,
      editDeadline: null,
      readOnlyReason: null,
    });
  }
  public create(): Promise<unknown> {
    return Promise.resolve({ evaluation: { id: randomUUID() }, occurrenceContested: false });
  }
  public updateMine(): Promise<unknown> {
    return Promise.resolve({ evaluation: { id: randomUUID(), rating: 4 } });
  }
  public list(): Promise<unknown> {
    return Promise.resolve({ evaluations: [], pagination: { page: 1, limit: 20, total: 0 } });
  }
  public summary(): Promise<unknown> {
    return Promise.resolve({ summary: { total: 0, negativePercentage: 0 } });
  }
}

async function authenticatedApp(role: UserRole) {
  const identityRepository = new InMemoryIdentityRepository();
  const user = makeUser({ role, municipalityId: randomUUID(), status: 'ACTIVE', deletedAt: null });
  const sessionId = randomUUID();
  identityRepository.addUser(user);
  await identityRepository.createRefreshToken({
    sessionId,
    userId: user.id,
    tokenHash: randomUUID(),
    expiresAt: new Date(Date.now() + 60_000),
    ipAddress: null,
    userAgent: null,
  });
  return {
    app: createApp({
      identityRepository,
      evaluationsService: new FakeEvaluationsService(),
    }),
    token: await signAccessToken(user, sessionId),
  };
}

describe('rotas HTTP da Fase 6', () => {
  it('publica o resumo agregado sem autenticacao', async () => {
    await request(createApp({ evaluationsService: new FakeEvaluationsService() }))
      .get(`/api/v1/occurrences/${randomUUID()}/evaluations/summary`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({ data: { summary: { total: 0 } } }),
      );
  });

  it('exige cidadao autenticado para criar avaliacao', async () => {
    const occurrenceId = randomUUID();
    await request(createApp({ evaluationsService: new FakeEvaluationsService() }))
      .post(`/api/v1/occurrences/${occurrenceId}/evaluations`)
      .send({ rating: 5, problemResolved: true })
      .expect(401);
    const operator = await authenticatedApp('CITY_OPERATOR');
    await request(operator.app)
      .post(`/api/v1/occurrences/${occurrenceId}/evaluations`)
      .set('authorization', `Bearer ${operator.token}`)
      .send({ rating: 5, problemResolved: true })
      .expect(403);
  });

  it('cria avaliacao valida para cidadao', async () => {
    const citizen = await authenticatedApp('CITIZEN');
    await request(citizen.app)
      .post(`/api/v1/occurrences/${randomUUID()}/evaluations`)
      .set('authorization', `Bearer ${citizen.token}`)
      .send({
        rating: 2,
        problemResolved: false,
        serviceQuality: 3,
        comment: 'O problema continua.',
      })
      .expect(201);
  });

  it('protege a listagem detalhada e aceita paginacao', async () => {
    const occurrenceId = randomUUID();
    await request(createApp({ evaluationsService: new FakeEvaluationsService() }))
      .get(`/api/v1/occurrences/${occurrenceId}/evaluations`)
      .expect(401);
    const moderator = await authenticatedApp('MODERATOR');
    await request(moderator.app)
      .get(`/api/v1/occurrences/${occurrenceId}/evaluations?page=1&limit=10`)
      .set('authorization', `Bearer ${moderator.token}`)
      .expect(200);
  });

  it('consulta propria exige cidadao autenticado e valida o identificador', async () => {
    const path = `/api/v1/occurrences/${randomUUID()}/evaluations/me`;
    await request(createApp({ evaluationsService: new FakeEvaluationsService() }))
      .get(path)
      .expect(401);
    const admin = await authenticatedApp('ADMIN');
    await request(admin.app).get(path).set('authorization', `Bearer ${admin.token}`).expect(403);
    const citizen = await authenticatedApp('CITIZEN');
    await request(citizen.app)
      .get(path)
      .set('authorization', `Bearer ${citizen.token}`)
      .expect(200)
      .expect((response) =>
        expect(response.body as unknown).toMatchObject({
          data: { evaluation: null, canCreate: false },
        }),
      );
    await request(citizen.app)
      .get('/api/v1/occurrences/invalido/evaluations/me')
      .set('authorization', `Bearer ${citizen.token}`)
      .expect(422);
  });

  it('edita a propria avaliacao', async () => {
    const citizen = await authenticatedApp('CITIZEN');
    await request(citizen.app)
      .patch(`/api/v1/occurrences/${randomUUID()}/evaluations/me`)
      .set('authorization', `Bearer ${citizen.token}`)
      .send({ rating: 4, problemResolved: true })
      .expect(200);
  });

  it('valida UUID, notas e corpo de edicao', async () => {
    const citizen = await authenticatedApp('CITIZEN');
    const authorization = { authorization: `Bearer ${citizen.token}` };
    await request(citizen.app)
      .post('/api/v1/occurrences/invalida/evaluations')
      .set(authorization)
      .send({ rating: 5, problemResolved: true })
      .expect(422);
    await request(citizen.app)
      .post(`/api/v1/occurrences/${randomUUID()}/evaluations`)
      .set(authorization)
      .send({ rating: 6, problemResolved: true })
      .expect(422)
      .expect((response) =>
        expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR'),
      );
    await request(citizen.app)
      .patch(`/api/v1/occurrences/${randomUUID()}/evaluations/me`)
      .set(authorization)
      .send({})
      .expect(422);
  });
});
