import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/modules/auth/auth.security.js';
import type { UserRole, UserStatus } from '../../src/modules/auth/auth.types.js';
import { InMemoryIdentityRepository, makeUser } from '../helpers/in-memory-identity-repository.js';

interface SessionBody {
  success: true;
  data: {
    accessToken: string;
    expiresIn: number;
    user: { id: string; role: UserRole; passwordHash?: string };
    refreshToken?: string;
  };
}

interface ErrorBody {
  error: { code: string };
}

function cookieFrom(response: request.Response): string {
  const header: unknown = response.headers['set-cookie'];
  const raw: unknown = Array.isArray(header) ? header[0] : header;
  if (typeof raw !== 'string') {
    throw new Error('Cookie esperado nao foi recebido.');
  }
  return raw.split(';')[0] as string;
}

describe('autenticacao HTTP', () => {
  const municipalityId = randomUUID();
  const otherMunicipalityId = randomUUID();
  let repository: InMemoryIdentityRepository;
  let passwordHash: string;

  beforeEach(async () => {
    repository = new InMemoryIdentityRepository();
    repository.activeMunicipalities.add(municipalityId);
    repository.activeMunicipalities.add(otherMunicipalityId);
    passwordHash = await hashPassword('SenhaForte123!');
  });

  function addUser(
    role: UserRole = 'CITIZEN',
    status: UserStatus = 'ACTIVE',
    municipality = municipalityId,
  ) {
    const user = makeUser({
      email: `${role.toLowerCase()}-${randomUUID()}@example.test`,
      passwordHash,
      role,
      status,
      municipalityId: municipality,
    });
    repository.addUser(user);
    return Promise.resolve(user);
  }

  async function login(user: { email: string }, password = 'SenhaForte123!') {
    return request(createApp({ identityRepository: repository }))
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });
  }

  it('cadastra somente como CITIZEN, normaliza telefone e nunca devolve hashes', async () => {
    const app = createApp({ identityRepository: repository });
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Nova Cidada',
        email: 'NOVA@example.test',
        phone: '(71) 99999-1234',
        password: 'SenhaForte123!',
        municipalityId,
      })
      .expect(201);
    const body = response.body as {
      data: { user: { role: UserRole; phone: string; passwordHash?: string } };
    };

    expect(body.data.user).toMatchObject({ role: 'CITIZEN', phone: '+71999991234' });
    expect(body.data.user.passwordHash).toBeUndefined();

    const forbiddenRole = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Outra Cidada',
        email: 'outra@example.test',
        password: 'SenhaForte123!',
        municipalityId,
        role: 'ADMIN',
      })
      .expect(422);
    expect((forbiddenRole.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });

  it('retorna 409 para e-mail duplicado e 422 para municipio invalido', async () => {
    const user = await addUser();
    const app = createApp({ identityRepository: repository });
    const duplicate = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Duplicada',
        email: user.email,
        password: 'SenhaForte123!',
        municipalityId,
      })
      .expect(409);
    expect((duplicate.body as ErrorBody).error.code).toBe('USER_ALREADY_EXISTS');

    const invalidMunicipality = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Municipio Invalido',
        email: 'municipio@example.test',
        password: 'SenhaForte123!',
        municipalityId: randomUUID(),
      })
      .expect(422);
    expect((invalidMunicipality.body as ErrorBody).error.code).toBe('INVALID_MUNICIPALITY');
  });

  it('faz login, entrega refresh somente em cookie httpOnly e acessa rota protegida', async () => {
    const user = await addUser();
    const response = await login(user);
    expect(response.status).toBe(200);
    const body = response.body as SessionBody;
    const setCookie = response.headers['set-cookie'] as unknown as string[];

    expect(body.data.accessToken).toBeTypeOf('string');
    expect(body.data.expiresIn).toBe(900);
    expect(body.data.refreshToken).toBeUndefined();
    expect(body.data.user.passwordHash).toBeUndefined();
    expect(setCookie[0]).toContain('HttpOnly');
    expect(setCookie[0]).toContain('SameSite=Lax');
    expect(setCookie[0]).toContain('Path=/api/v1/auth');

    await request(createApp({ identityRepository: repository }))
      .get('/api/v1/auth/me')
      .set('authorization', `Bearer ${body.data.accessToken}`)
      .expect(200);
  });

  it('trata senha errada, token ausente e usuario bloqueado', async () => {
    const active = await addUser();
    const wrongPassword = await login(active, 'senha-incorreta');
    expect(wrongPassword.status).toBe(401);
    expect((wrongPassword.body as ErrorBody).error.code).toBe('INVALID_CREDENTIALS');

    const missingToken = await request(createApp({ identityRepository: repository }))
      .get('/api/v1/users/me')
      .expect(401);
    expect((missingToken.body as ErrorBody).error.code).toBe('AUTHENTICATION_REQUIRED');

    const blocked = await addUser('CITIZEN', 'BLOCKED');
    const blockedLogin = await login(blocked);
    expect(blockedLogin.status).toBe(403);
    expect((blockedLogin.body as ErrorBody).error.code).toBe('USER_BLOCKED');
  });

  it('rotaciona refresh e revoga toda a sessao quando o token antigo e reutilizado', async () => {
    const user = await addUser();
    const firstLogin = await login(user);
    const firstCookie = cookieFrom(firstLogin);

    const refresh = await request(createApp({ identityRepository: repository }))
      .post('/api/v1/auth/refresh')
      .set('cookie', firstCookie)
      .expect(200);
    const refreshedBody = refresh.body as SessionBody;
    expect(cookieFrom(refresh)).not.toBe(firstCookie);

    const reuse = await request(createApp({ identityRepository: repository }))
      .post('/api/v1/auth/refresh')
      .set('cookie', firstCookie)
      .expect(401);
    expect((reuse.body as ErrorBody).error.code).toBe('REFRESH_TOKEN_REUSE_DETECTED');

    const revokedAccess = await request(createApp({ identityRepository: repository }))
      .get('/api/v1/auth/me')
      .set('authorization', `Bearer ${refreshedBody.data.accessToken}`)
      .expect(401);
    expect((revokedAccess.body as ErrorBody).error.code).toBe('SESSION_REVOKED');
  });

  it('logout e troca de senha revogam as sessoes', async () => {
    const user = await addUser();
    const firstLogin = await login(user);
    const firstBody = firstLogin.body as SessionBody;
    await request(createApp({ identityRepository: repository }))
      .post('/api/v1/auth/logout')
      .set('cookie', cookieFrom(firstLogin))
      .expect(204);
    await request(createApp({ identityRepository: repository }))
      .get('/api/v1/auth/me')
      .set('authorization', `Bearer ${firstBody.data.accessToken}`)
      .expect(401);

    const secondLogin = await login(user);
    const secondBody = secondLogin.body as SessionBody;
    await request(createApp({ identityRepository: repository }))
      .post('/api/v1/auth/change-password')
      .set('authorization', `Bearer ${secondBody.data.accessToken}`)
      .send({ currentPassword: 'SenhaForte123!', newPassword: 'NovaSenhaForte456!' })
      .expect(204);
    await request(createApp({ identityRepository: repository }))
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${secondBody.data.accessToken}`)
      .expect(401);
  });

  it('aplica perfis nas rotas administrativas e permite exclusao logica', async () => {
    const citizen = await addUser();
    const admin = await addUser('ADMIN');
    const citizenLogin = (await login(citizen)).body as SessionBody;
    const adminLogin = (await login(admin)).body as SessionBody;
    const app = createApp({ identityRepository: repository });

    await request(app)
      .get('/api/v1/admin/users')
      .set('authorization', `Bearer ${citizenLogin.data.accessToken}`)
      .expect(403);
    const list = await request(app)
      .get('/api/v1/admin/users')
      .set('authorization', `Bearer ${adminLogin.data.accessToken}`)
      .expect(200);
    expect((list.body as { data: { total: number } }).data.total).toBe(2);

    await request(app)
      .delete('/api/v1/users/me')
      .set('authorization', `Bearer ${citizenLogin.data.accessToken}`)
      .expect(204);
    expect(repository.users.get(citizen.id)?.status).toBe('DELETED');
    expect(repository.users.get(citizen.id)?.deletedAt).toBeInstanceOf(Date);
  });

  it('atualiza o perfil e trata telefone duplicado e municipio invalido', async () => {
    const citizen = await addUser();
    const other = await addUser();
    repository.users.set(other.id, { ...other, phone: '+5571999998877' });
    const session = (await login(citizen)).body as SessionBody;
    const app = createApp({ identityRepository: repository });

    const updated = await request(app)
      .patch('/api/v1/users/me')
      .set('authorization', `Bearer ${session.data.accessToken}`)
      .send({
        name: 'Nome Atualizado',
        phone: '(71) 98888-7766',
        municipalityId: otherMunicipalityId,
      })
      .expect(200);
    const updatedBody = updated.body as {
      data: { user: { name: string; phone: string; municipalityId: string } };
    };
    expect(updatedBody.data.user).toMatchObject({
      name: 'Nome Atualizado',
      phone: '+71988887766',
      municipalityId: otherMunicipalityId,
    });

    const duplicate = await request(app)
      .patch('/api/v1/users/me')
      .set('authorization', `Bearer ${session.data.accessToken}`)
      .send({ phone: '+5571999998877' })
      .expect(409);
    expect((duplicate.body as ErrorBody).error.code).toBe('USER_ALREADY_EXISTS');

    const invalidMunicipality = await request(app)
      .patch('/api/v1/users/me')
      .set('authorization', `Bearer ${session.data.accessToken}`)
      .send({ municipalityId: randomUUID() })
      .expect(422);
    expect((invalidMunicipality.body as ErrorBody).error.code).toBe('INVALID_MUNICIPALITY');
  });

  it('permite ao ADMIN consultar, bloquear e alterar perfil de outro usuario', async () => {
    const citizen = await addUser();
    const admin = await addUser('ADMIN');
    const adminSession = (await login(admin)).body as SessionBody;
    const authorization = `Bearer ${adminSession.data.accessToken}`;
    const app = createApp({ identityRepository: repository });

    const found = await request(app)
      .get(`/api/v1/admin/users/${citizen.id}`)
      .set('authorization', authorization)
      .expect(200);
    expect((found.body as { data: { user: { id: string } } }).data.user.id).toBe(citizen.id);

    const blocked = await request(app)
      .patch(`/api/v1/admin/users/${citizen.id}/status`)
      .set('authorization', authorization)
      .send({ status: 'BLOCKED' })
      .expect(200);
    expect((blocked.body as { data: { user: { status: string } } }).data.user.status).toBe(
      'BLOCKED',
    );

    const promoted = await request(app)
      .patch(`/api/v1/admin/users/${citizen.id}/role`)
      .set('authorization', authorization)
      .send({ role: 'CITY_OPERATOR' })
      .expect(200);
    expect((promoted.body as { data: { user: { role: string } } }).data.user.role).toBe(
      'CITY_OPERATOR',
    );

    const missing = await request(app)
      .get(`/api/v1/admin/users/${randomUUID()}`)
      .set('authorization', authorization)
      .expect(404);
    expect((missing.body as ErrorBody).error.code).toBe('USER_NOT_FOUND');
  });

  it('exige cookie no refresh e rejeita usuario pendente', async () => {
    const missingRefresh = await request(createApp({ identityRepository: repository }))
      .post('/api/v1/auth/refresh')
      .expect(401);
    expect((missingRefresh.body as ErrorBody).error.code).toBe('REFRESH_TOKEN_REQUIRED');

    const pending = await addUser('CITY_OPERATOR', 'PENDING');
    const pendingLogin = await login(pending);
    expect(pendingLogin.status).toBe(403);
    expect((pendingLogin.body as ErrorBody).error.code).toBe('USER_PENDING');
  });
});
