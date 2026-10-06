/* eslint-disable @typescript-eslint/unbound-method -- Repository methods here are Vitest mocks without this. */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { InMemoryApiRateLimiter } from '../../src/shared/middleware/api-rate-limit.js';
import { AppError } from '../../src/shared/errors/app-error.js';
import { signAccessToken } from '../../src/modules/auth/auth.security.js';
import type {
  MediaRecord,
  MediaRepository,
  ModerationDecision,
} from '../../src/modules/media/media.types.js';
import type { UserRole } from '../../src/modules/auth/auth.types.js';
import { InMemoryIdentityRepository, makeUser } from '../helpers/in-memory-identity-repository.js';

const municipalityId = randomUUID();
const ownerId = randomUUID();
const image: MediaRecord = {
  id: randomUUID(),
  occurrenceId: randomUUID(),
  storageKey: 'occurrences/2026/test.png',
  mimeType: 'image/png',
  moderationStatus: 'PENDING',
  occurrenceStatus: 'PENDING_REVIEW',
  municipalityId,
  ownerId,
  title: 'Imagem em revisao',
  protocol: 'TNR-2026-000123',
  createdAt: new Date(),
};
const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
async function setup(
  options: {
    role?: UserRole;
    sameMunicipality?: boolean;
    owner?: boolean;
    record?: MediaRecord | null;
  } = {},
) {
  const identity = new InMemoryIdentityRepository();
  const user = makeUser({
    id: options.owner ? ownerId : randomUUID(),
    role: options.role ?? 'CITIZEN',
    municipalityId: options.sameMunicipality ? municipalityId : randomUUID(),
  });
  identity.addUser(user);
  const sessionId = randomUUID();
  await identity.createRefreshToken({
    sessionId,
    userId: user.id,
    tokenHash: randomUUID(),
    expiresAt: new Date(Date.now() + 60000),
    ipAddress: null,
    userAgent: null,
  });
  let record = options.record === undefined ? { ...image } : options.record;
  const repository: MediaRepository = {
    find: vi.fn(() => Promise.resolve(record)),
    list: vi.fn(() =>
      Promise.resolve({ images: record === null ? [] : [record], total: record === null ? 0 : 1 }),
    ),
    review: vi.fn((_id: string, decision: ModerationDecision) => {
      if (record === null) return Promise.resolve(null);
      if (record.moderationStatus !== decision.expectedStatus)
        return Promise.reject(new AppError(409, 'IMAGE_REVIEW_CONFLICT', 'Conflito.'));
      record = { ...record, moderationStatus: decision.status };
      return Promise.resolve(record);
    }),
  };
  const reader = { read: vi.fn(() => Promise.resolve(bytes)) };
  return {
    app: createApp({
      identityRepository: identity,
      mediaRepository: repository,
      mediaReader: reader,
    }),
    reader,
    repository,
    token: await signAccessToken(user, sessionId),
  };
}
describe('controle de acesso e revisao de imagens', () => {
  it('compartilha rate limit entre URLs novas e antigas', async () => {
    const repository: MediaRepository = {
      find: () => Promise.resolve(null),
      list: () => Promise.resolve({ images: [], total: 0 }),
      review: () => Promise.resolve(null),
    };
    const app = createApp({
      mediaRepository: repository,
      apiRateLimiter: new InMemoryApiRateLimiter(1, 60),
    });
    await request(app).get('/uploads/orphan.png').expect(404);
    await request(app).get(`/api/v1/media/${image.id}`).expect(429);
  });
  it.each(['PENDING', 'REJECTED', 'FLAGGED'] as const)(
    'nao entrega imagem %s por URL publica nem legado',
    async (status) => {
      const { app, reader } = await setup({
        record: { ...image, occurrenceStatus: 'PUBLISHED', moderationStatus: status },
      });
      await request(app).get(`/api/v1/media/${image.id}`).expect(404);
      await request(app).get(`/uploads/${image.storageKey}`).expect(404);
      expect(reader.read).not.toHaveBeenCalled();
    },
  );
  it('exige imagem aprovada e ocorrencia publica para acesso anonimo', async () => {
    const hidden = await setup({ record: { ...image, moderationStatus: 'APPROVED' } });
    await request(hidden.app).get(`/api/v1/media/${image.id}`).expect(404);
    const published = await setup({
      record: {
        ...image,
        occurrenceStatus: 'PUBLISHED',
        moderationStatus: 'APPROVED',
        publicStorageKey: 'derived.webp',
      },
    });
    const response = await request(published.app).get(`/api/v1/media/${image.id}`).expect(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.headers['content-type']).toContain('image/webp');
  });
  it('nunca publica originais legados sem copia sanitizada', async () => {
    const { app, reader } = await setup({
      record: { ...image, moderationStatus: 'APPROVED', occurrenceStatus: 'PUBLISHED' },
    });
    await request(app).get(`/api/v1/media/${image.id}`).expect(404);
    await request(app)
      .get('/uploads/' + image.storageKey)
      .expect(404);
    expect(reader.read).not.toHaveBeenCalled();
  });
  it('publico recebe copia e a rota original exige permissao privada', async () => {
    const record = {
      ...image,
      moderationStatus: 'APPROVED' as const,
      occurrenceStatus: 'PUBLISHED' as const,
      publicStorageKey: 'derived.webp',
    };
    const owner = await setup({ record, owner: true });
    await request(owner.app).get(`/api/v1/media/${image.id}`).expect(200);
    expect(owner.reader.read).toHaveBeenLastCalledWith('derived.webp');
    await request(owner.app).get(`/api/v1/media/${image.id}/original`).expect(401);
    await request(owner.app)
      .get(`/api/v1/media/${image.id}/original`)
      .auth(owner.token, { type: 'bearer' })
      .expect(200);
    expect(owner.reader.read).toHaveBeenLastCalledWith(image.storageKey);
    const other = await setup({ record });
    await request(other.app)
      .get(`/api/v1/media/${image.id}/original`)
      .auth(other.token, { type: 'bearer' })
      .expect(404);
    const operator = await setup({ record, role: 'CITY_OPERATOR' });
    await request(operator.app)
      .get(`/api/v1/media/${image.id}/original`)
      .auth(operator.token, { type: 'bearer' })
      .expect(404);
  });
  it('permite revisao privada pelo autor mas nao por outro cidadao', async () => {
    const own = await setup({ owner: true });
    await request(own.app)
      .get(`/api/v1/media/${image.id}`)
      .auth(own.token, { type: 'bearer' })
      .expect(200);
    const other = await setup();
    await request(other.app)
      .get(`/api/v1/media/${image.id}`)
      .auth(other.token, { type: 'bearer' })
      .expect(404);
  });
  it('isola operadores municipais e permite moderadores', async () => {
    const own = await setup({ role: 'CITY_OPERATOR', sameMunicipality: true });
    await request(own.app)
      .get(`/api/v1/media/${image.id}`)
      .auth(own.token, { type: 'bearer' })
      .expect(200);
    const other = await setup({ role: 'CITY_OPERATOR' });
    await request(other.app)
      .get(`/api/v1/media/${image.id}`)
      .auth(other.token, { type: 'bearer' })
      .expect(404);
    const moderator = await setup({ role: 'MODERATOR' });
    await request(moderator.app)
      .get(`/api/v1/media/${image.id}`)
      .auth(moderator.token, { type: 'bearer' })
      .expect(200);
  });
  it('nao serve arquivo orfao existente no disco', async () => {
    const { app } = await setup({ record: null });
    const name = `${randomUUID()}.png`;
    const directory = path.resolve(env.STORAGE_LOCAL_DIRECTORY);
    await mkdir(directory, { recursive: true });
    const target = path.join(directory, name);
    await writeFile(target, bytes);
    try {
      await request(app).get(`/uploads/${name}`).expect(404);
    } finally {
      await unlink(target);
    }
  });
  it.each(['CITIZEN', 'CITY_OPERATOR'] as const)(
    'impede %s de listar ou aprovar a fila',
    async (role) => {
      const { app, token, repository } = await setup({ role });
      await request(app)
        .get('/api/v1/moderation/images')
        .auth(token, { type: 'bearer' })
        .expect(403);
      await request(app)
        .patch(`/api/v1/moderation/images/${image.id}`)
        .auth(token, { type: 'bearer' })
        .send({ status: 'APPROVED', expectedStatus: 'PENDING', reason: 'Imagem adequada' })
        .expect(403);
      expect(repository.review).not.toHaveBeenCalled();
    },
  );
  it('exige autenticacao, motivo e estado esperado e detecta revisao concorrente', async () => {
    const { app, token } = await setup({ role: 'ADMIN' });
    await request(app).get('/api/v1/moderation/images').expect(401);
    await request(app).get('/api/v1/moderation/images').auth(token, { type: 'bearer' }).expect(200);
    await request(app)
      .patch(`/api/v1/moderation/images/${image.id}`)
      .auth(token, { type: 'bearer' })
      .send({ status: 'APPROVED' })
      .expect(422);
    const body = { status: 'APPROVED', expectedStatus: 'PENDING', reason: 'Imagem adequada' };
    await request(app)
      .patch(`/api/v1/moderation/images/${image.id}`)
      .auth(token, { type: 'bearer' })
      .send(body)
      .expect(200);
    await request(app)
      .patch(`/api/v1/moderation/images/${image.id}`)
      .auth(token, { type: 'bearer' })
      .send(body)
      .expect(409);
    await request(app).get(`/api/v1/media/${image.id}`).expect(404);
  });
  it('nao entrega foto excluida e rejeita UUID invalido antes de consultar', async () => {
    const { app, reader, repository } = await setup({ record: null });
    await request(app).get(`/api/v1/media/${image.id}`).expect(404);
    await request(app).get('/api/v1/media/not-a-uuid').expect(422);
    expect(reader.read).not.toHaveBeenCalled();
    expect(repository.find).toHaveBeenCalledTimes(1);
  });
});
