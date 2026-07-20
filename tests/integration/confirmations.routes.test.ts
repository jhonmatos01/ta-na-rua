import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/modules/auth/auth.security.js';
import type { UserRole } from '../../src/modules/auth/auth.types.js';
import type { CreateConfirmationInput } from '../../src/modules/confirmations/confirmations.schemas.js';
import type { ConfirmationsService } from '../../src/modules/confirmations/confirmations.types.js';
import { InMemoryIdentityRepository, makeUser } from '../helpers/in-memory-identity-repository.js';

interface ErrorBody {
  error: { code: string };
}

interface ConfirmationResponseBody {
  data: {
    occurrenceId?: string;
    confirmationCount?: number;
    priorityScore?: number;
    occurrence?: { confirmationCount: number; priorityScore: number };
  };
}

class FakeConfirmationsService implements ConfirmationsService {
  public receivedInput: CreateConfirmationInput | null = null;

  public confirm(
    _principal: Parameters<ConfirmationsService['confirm']>[0],
    occurrenceId: string,
    input: CreateConfirmationInput,
  ): Promise<unknown> {
    this.receivedInput = input;
    return Promise.resolve({
      confirmation: { id: randomUUID(), occurrenceId, ...input },
      occurrence: { confirmationCount: 2, priorityScore: 31.75 },
    });
  }

  public remove(): Promise<void> {
    return Promise.resolve();
  }

  public count(
    principal: Parameters<ConfirmationsService['count']>[0],
    occurrenceId: string,
  ): Promise<unknown> {
    return Promise.resolve({
      occurrenceId,
      confirmationCount: 2,
      priorityScore: 31.75,
      ...(principal === undefined ? {} : { confirmedByMe: true }),
    });
  }
}

async function authenticatedApp(role: UserRole = 'CITIZEN') {
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
  const confirmationsService = new FakeConfirmationsService();
  return {
    app: createApp({ identityRepository: repository, confirmationsService }),
    service: confirmationsService,
    token: await signAccessToken(user, sessionId),
  };
}

describe('rotas HTTP de confirmacoes', () => {
  it('retorna a contagem publicamente', async () => {
    const occurrenceId = randomUUID();
    const response = await request(
      createApp({ confirmationsService: new FakeConfirmationsService() }),
    )
      .get(`/api/v1/occurrences/${occurrenceId}/confirmations/count`)
      .expect(200);
    expect((response.body as ConfirmationResponseBody).data).toEqual({
      occurrenceId,
      confirmationCount: 2,
      priorityScore: 31.75,
    });
  });

  it('exige autenticacao para confirmar', async () => {
    const occurrenceId = randomUUID();
    await request(createApp({ confirmationsService: new FakeConfirmationsService() }))
      .post(`/api/v1/occurrences/${occurrenceId}/confirmations`)
      .send({})
      .expect(401)
      .expect((response) =>
        expect((response.body as ErrorBody).error.code).toBe('AUTHENTICATION_REQUIRED'),
      );
  });

  it('cria confirmacao com valores padrao para um cidadao', async () => {
    const occurrenceId = randomUUID();
    const { app, service, token } = await authenticatedApp();
    const response = await request(app)
      .post(`/api/v1/occurrences/${occurrenceId}/confirmations`)
      .set('authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(service.receivedInput).toEqual({
      directlyAffected: false,
      problemWorsened: false,
      comment: null,
    });
    expect((response.body as ConfirmationResponseBody).data.occurrence).toEqual({
      confirmationCount: 2,
      priorityScore: 31.75,
    });
  });

  it('restringe a acao ao perfil CITIZEN', async () => {
    const { app, token } = await authenticatedApp('CITY_OPERATOR');
    await request(app)
      .post(`/api/v1/occurrences/${randomUUID()}/confirmations`)
      .set('authorization', `Bearer ${token}`)
      .send({})
      .expect(403)
      .expect((response) => expect((response.body as ErrorBody).error.code).toBe('FORBIDDEN'));
  });

  it('valida UUID, campos extras e comentario de 500 caracteres', async () => {
    const { app, token } = await authenticatedApp();
    await request(app)
      .post('/api/v1/occurrences/invalido/confirmations')
      .set('authorization', `Bearer ${token}`)
      .send({})
      .expect(422);
    await request(app)
      .post(`/api/v1/occurrences/${randomUUID()}/confirmations`)
      .set('authorization', `Bearer ${token}`)
      .send({ extra: true })
      .expect(422);
    await request(app)
      .post(`/api/v1/occurrences/${randomUUID()}/confirmations`)
      .set('authorization', `Bearer ${token}`)
      .send({ comment: 'x'.repeat(501) })
      .expect(422);
  });

  it('remove a confirmacao do cidadao autenticado', async () => {
    const { app, token } = await authenticatedApp();
    await request(app)
      .delete(`/api/v1/occurrences/${randomUUID()}/confirmations/me`)
      .set('authorization', `Bearer ${token}`)
      .expect(204);
  });
});
