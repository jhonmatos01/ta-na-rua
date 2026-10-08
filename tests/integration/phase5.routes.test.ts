import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/modules/auth/auth.security.js';
import type { UserRole } from '../../src/modules/auth/auth.types.js';
import type { DepartmentsService } from '../../src/modules/departments/departments.types.js';
import type { StatusService } from '../../src/modules/status/status.types.js';
import { InMemoryIdentityRepository, makeUser } from '../helpers/in-memory-identity-repository.js';

interface ErrorBody {
  error: { code: string };
}

class FakeStatusService implements StatusService {
  public transition(): Promise<unknown> {
    return Promise.resolve({ occurrence: { id: randomUUID(), status: 'FORWARDED' } });
  }
  public assign(): Promise<unknown> {
    return Promise.resolve({
      occurrence: { id: randomUUID(), assignedDepartmentId: randomUUID() },
    });
  }
  public capabilities(): Promise<unknown> {
    return Promise.resolve({
      occurrence: { id: randomUUID(), status: 'PUBLISHED' },
      actions: [{ status: 'FORWARDED', requiredFields: ['departmentId'] }],
      canAssign: true,
      canDelete: false,
    });
  }
  public history(): Promise<unknown> {
    return Promise.resolve({ history: [] });
  }
}

class FakeDepartmentsService implements DepartmentsService {
  public list(): Promise<unknown> {
    return Promise.resolve({ departments: [], pagination: { page: 1, limit: 20, total: 0 } });
  }
  public get(): Promise<unknown> {
    return Promise.resolve({ department: { id: randomUUID() } });
  }
  public create(): Promise<unknown> {
    return Promise.resolve({ department: { id: randomUUID(), active: true } });
  }
  public update(): Promise<unknown> {
    return Promise.resolve({ department: { id: randomUUID() } });
  }
  public setActive(): Promise<unknown> {
    return Promise.resolve({ department: { id: randomUUID(), active: false } });
  }
  public remove(): Promise<void> {
    return Promise.resolve();
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
      statusService: new FakeStatusService(),
      departmentsService: new FakeDepartmentsService(),
    }),
    token: await signAccessToken(user, sessionId),
  };
}

describe('rotas HTTP da Fase 5', () => {
  it('publica o historico de status sem autenticacao', async () => {
    await request(createApp({ statusService: new FakeStatusService() }))
      .get(`/api/v1/occurrences/${randomUUID()}/status-history`)
      .expect(200)
      .expect((response) => expect(response.body).toMatchObject({ data: { history: [] } }));
  });

  it('exige autenticacao operacional para alterar status', async () => {
    await request(createApp({ statusService: new FakeStatusService() }))
      .patch(`/api/v1/occurrences/${randomUUID()}/status`)
      .send({ status: 'PUBLISHED' })
      .expect(401)
      .expect((response) =>
        expect((response.body as ErrorBody).error.code).toBe('AUTHENTICATION_REQUIRED'),
      );
    const citizen = await authenticatedApp('CITIZEN');
    await request(citizen.app)
      .patch(`/api/v1/occurrences/${randomUUID()}/status`)
      .set('authorization', `Bearer ${citizen.token}`)
      .send({ status: 'PUBLISHED' })
      .expect(403);
  });

  it('valida UUID e campos estritos na transicao', async () => {
    const operator = await authenticatedApp('CITY_OPERATOR');
    await request(operator.app)
      .patch('/api/v1/occurrences/invalida/status')
      .set('authorization', `Bearer ${operator.token}`)
      .send({ status: 'PUBLISHED' })
      .expect(422);
    await request(operator.app)
      .patch(`/api/v1/occurrences/${randomUUID()}/status`)
      .set('authorization', `Bearer ${operator.token}`)
      .send({ status: 'PUBLISHED', extra: true })
      .expect(422);
  });

  it('aceita status e atribuicao para operador', async () => {
    const operator = await authenticatedApp('CITY_OPERATOR');
    const occurrenceId = randomUUID();
    await request(operator.app)
      .patch(`/api/v1/occurrences/${occurrenceId}/status`)
      .set('authorization', `Bearer ${operator.token}`)
      .send({
        status: 'FORWARDED',
        departmentId: randomUUID(),
        expectedResolutionAt: '2026-07-25T12:00:00.000Z',
      })
      .expect(200);
    await request(operator.app)
      .patch(`/api/v1/occurrences/${occurrenceId}/assignment`)
      .set('authorization', `Bearer ${operator.token}`)
      .send({ departmentId: randomUUID() })
      .expect(200);
    await request(operator.app)
      .get(`/api/v1/occurrences/${occurrenceId}/status-capabilities`)
      .set('authorization', `Bearer ${operator.token}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          data: {
            canAssign: true,
            canDelete: false,
            actions: [{ status: 'FORWARDED' }],
          },
        }),
      );
  });

  it('protege todas as rotas de departamentos', async () => {
    await request(createApp({ departmentsService: new FakeDepartmentsService() }))
      .get('/api/v1/departments')
      .expect(401);
    const citizen = await authenticatedApp('CITIZEN');
    await request(citizen.app)
      .get('/api/v1/departments')
      .set('authorization', `Bearer ${citizen.token}`)
      .expect(403);
  });

  it('expoe CRUD e ativacao de departamentos', async () => {
    const admin = await authenticatedApp('ADMIN');
    const departmentId = randomUUID();
    const authorization = { authorization: `Bearer ${admin.token}` };
    await request(admin.app).get('/api/v1/departments').set(authorization).expect(200);
    await request(admin.app)
      .post('/api/v1/departments')
      .set(authorization)
      .send({ municipalityId: randomUUID(), name: 'Obras e reparos' })
      .expect(201);
    await request(admin.app)
      .get(`/api/v1/departments/${departmentId}`)
      .set(authorization)
      .expect(200);
    await request(admin.app)
      .patch(`/api/v1/departments/${departmentId}`)
      .set(authorization)
      .send({ description: 'Atendimento viario.' })
      .expect(200);
    await request(admin.app)
      .patch(`/api/v1/departments/${departmentId}/active`)
      .set(authorization)
      .send({ active: false })
      .expect(200);
    await request(admin.app)
      .delete(`/api/v1/departments/${departmentId}`)
      .set(authorization)
      .expect(204);
  });

  it('valida query e corpo de departamentos', async () => {
    const admin = await authenticatedApp('ADMIN');
    const authorization = { authorization: `Bearer ${admin.token}` };
    await request(admin.app)
      .get('/api/v1/departments?active=talvez')
      .set(authorization)
      .expect(422);
    await request(admin.app)
      .post('/api/v1/departments')
      .set(authorization)
      .send({ municipalityId: randomUUID(), name: 'x' })
      .expect(422);
  });
});
