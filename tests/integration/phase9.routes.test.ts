import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/modules/auth/auth.security.js';
import type { NotificationListQuery } from '../../src/modules/notifications/notifications.schemas.js';
import type { NotificationsService } from '../../src/modules/notifications/notifications.types.js';
import { InMemoryWebhookRateLimiter } from '../../src/modules/webhooks/webhook-rate-limit.js';
import { signWebhookPayload } from '../../src/modules/webhooks/webhook-security.js';
import { DefaultWebhooksService } from '../../src/modules/webhooks/webhooks.service.js';
import type {
  WebhookClaimResult,
  WebhookEventRecord,
  WebhookProcessingEffect,
  WebhookProvider,
  WebhooksRepository,
} from '../../src/modules/webhooks/webhooks.types.js';
import { InMemoryIdentityRepository, makeUser } from '../helpers/in-memory-identity-repository.js';

const now = new Date('2026-07-20T12:00:00.000Z');
const webhookSecret = 'phase-9-route-webhook-secret-with-32-characters';

class FakeNotificationsService implements NotificationsService {
  public lastUserId: string | null = null;
  public lastQuery: NotificationListQuery | null = null;

  public list(userId: string, query: NotificationListQuery): Promise<unknown> {
    this.lastUserId = userId;
    this.lastQuery = query;
    return Promise.resolve({ notifications: [], pagination: { page: query.page } });
  }
  public unreadCount(userId: string): Promise<unknown> {
    this.lastUserId = userId;
    return Promise.resolve({ unreadCount: 0 });
  }
  public markRead(userId: string, notificationId: string): Promise<unknown> {
    this.lastUserId = userId;
    return Promise.resolve({ notification: { id: notificationId } });
  }
  public markAllRead(userId: string): Promise<unknown> {
    this.lastUserId = userId;
    return Promise.resolve({ markedAsRead: 2 });
  }
}

class FakeWebhooksRepository implements WebhooksRepository {
  public duplicate = false;
  public effects: WebhookProcessingEffect[] = [];

  public claim(
    provider: WebhookProvider,
    externalEventId: string,
    eventType: string,
    payloadHash: string,
    receivedAt: Date,
  ): Promise<WebhookClaimResult> {
    const event: WebhookEventRecord = {
      id: randomUUID(),
      provider,
      externalEventId,
      eventType,
      payloadHash,
      status: this.duplicate ? 'PROCESSED' : 'PROCESSING',
      responseCode: this.duplicate ? 202 : null,
      errorMessage: null,
      receivedAt,
      processedAt: this.duplicate ? receivedAt : null,
    };
    return Promise.resolve(
      this.duplicate ? { kind: 'duplicate', event } : { kind: 'claimed', event },
    );
  }

  public complete(
    _event: WebhookEventRecord,
    effect: WebhookProcessingEffect,
  ): Promise<string | null> {
    this.effects.push(effect);
    return Promise.resolve(effect.kind === 'enqueue' ? randomUUID() : null);
  }

  public fail(): Promise<void> {
    return Promise.resolve();
  }
}

async function authenticatedNotificationsApp() {
  const identityRepository = new InMemoryIdentityRepository();
  const user = makeUser({ role: 'CITIZEN', municipalityId: randomUUID() });
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
  const notificationsService = new FakeNotificationsService();
  return {
    app: createApp({ identityRepository, notificationsService }),
    service: notificationsService,
    user,
    token: await signAccessToken(user, sessionId),
  };
}

function webhookApp(repository: WebhooksRepository) {
  const service = new DefaultWebhooksService(
    repository,
    {
      TELEGRAM: webhookSecret,
      WHATSAPP: webhookSecret,
      STATUS: webhookSecret,
      N8N: webhookSecret,
    },
    new InMemoryWebhookRateLimiter(30, 60, () => now),
    () => now,
    300,
  );
  return createApp({ webhooksService: service });
}

function signedPost(app: ReturnType<typeof createApp>, path: string, body: object) {
  const rawBody = Buffer.from(JSON.stringify(body));
  const timestamp = Math.floor(now.getTime() / 1_000);
  const externalEventId = (body as { externalEventId: string }).externalEventId;
  return request(app)
    .post(path)
    .set('content-type', 'application/json')
    .set('x-webhook-id', externalEventId)
    .set('x-webhook-timestamp', String(timestamp))
    .set('x-webhook-signature', signWebhookPayload(webhookSecret, timestamp, rawBody))
    .send(rawBody.toString('utf8'));
}

describe('rotas HTTP da Fase 9', () => {
  it('protege e disponibiliza as quatro rotas de notificacao', async () => {
    await request(createApp({ notificationsService: new FakeNotificationsService() }))
      .get('/api/v1/notifications')
      .expect(401);
    const authenticated = await authenticatedNotificationsApp();
    const headers = { authorization: `Bearer ${authenticated.token}` };
    await request(authenticated.app)
      .get('/api/v1/notifications?page=2&limit=5&unreadOnly=true')
      .set(headers)
      .expect(200);
    expect(authenticated.service.lastUserId).toBe(authenticated.user.id);
    expect(authenticated.service.lastQuery).toMatchObject({ page: 2, limit: 5, unreadOnly: true });
    await request(authenticated.app)
      .get('/api/v1/notifications/unread-count')
      .set(headers)
      .expect(200);
    await request(authenticated.app)
      .patch('/api/v1/notifications/read-all')
      .set(headers)
      .expect(200);
    await request(authenticated.app)
      .patch(`/api/v1/notifications/${randomUUID()}/read`)
      .set(headers)
      .expect(200);
    await request(authenticated.app)
      .patch('/api/v1/notifications/identificador-invalido/read')
      .set(headers)
      .expect(422);
  });

  it('aceita relato Telegram assinado e retorna duplicata com 200', async () => {
    const repository = new FakeWebhooksRepository();
    const app = webhookApp(repository);
    const body = {
      externalEventId: 'telegram-evt-1',
      eventType: 'REPORT_RECEIVED',
      occurredAt: now.toISOString(),
      data: {
        municipalityId: randomUUID(),
        title: 'Buraco na via',
        latitude: -12.98,
        longitude: -38.5,
      },
    };
    await signedPost(app, '/api/v1/webhooks/telegram/report', body)
      .expect(202)
      .expect((response) =>
        expect((response.body as { data: { duplicate: boolean } }).data.duplicate).toBe(false),
      );
    repository.duplicate = true;
    await signedPost(app, '/api/v1/webhooks/telegram/report', body)
      .expect(200)
      .expect((response) =>
        expect((response.body as { data: { duplicate: boolean } }).data.duplicate).toBe(true),
      );
    expect(repository.effects).toHaveLength(1);
  });

  it('rejeita assinatura ausente e payload invalido', async () => {
    const app = webhookApp(new FakeWebhooksRepository());
    await request(app)
      .post('/api/v1/webhooks/telegram/report')
      .send({
        externalEventId: 'telegram-evt-2',
        eventType: 'REPORT_RECEIVED',
        occurredAt: now.toISOString(),
        data: {
          municipalityId: randomUUID(),
          title: 'Buraco na via',
          latitude: -12.98,
          longitude: -38.5,
        },
      })
      .expect(401);
    await request(app)
      .post('/api/v1/webhooks/telegram/report')
      .send({ externalEventId: 'telegram-evt-3' })
      .expect(422);
  });

  it('disponibiliza WhatsApp, status e callback n8n com contratos separados', async () => {
    const repository = new FakeWebhooksRepository();
    const app = webhookApp(repository);
    await signedPost(app, '/api/v1/webhooks/whatsapp/report', {
      externalEventId: 'whatsapp-evt-1',
      eventType: 'REPORT_RECEIVED',
      occurredAt: now.toISOString(),
      data: {
        municipalityId: randomUUID(),
        title: 'Poste apagado',
        latitude: -12.97,
        longitude: -38.51,
      },
    }).expect(202);
    await signedPost(app, '/api/v1/webhooks/status-update', {
      externalEventId: 'status-evt-1',
      eventType: 'OCCURRENCE_STATUS_UPDATE',
      occurredAt: now.toISOString(),
      data: { occurrenceId: randomUUID(), status: 'IN_PROGRESS' },
    }).expect(202);
    await signedPost(app, '/api/v1/webhooks/n8n/events', {
      externalEventId: 'n8n-evt-1',
      eventType: 'OUTBOX_DELIVERY_CALLBACK',
      occurredAt: now.toISOString(),
      data: { outboxEventId: randomUUID(), deliveryStatus: 'PROCESSED' },
    }).expect(202);
    expect(repository.effects.map((effect) => effect.kind)).toEqual([
      'enqueue',
      'record_only',
      'outbox_callback',
    ]);
  });
});
