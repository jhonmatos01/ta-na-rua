import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { DefaultNotificationsService } from '../../src/modules/notifications/notifications.service.js';
import type {
  NotificationListResult,
  NotificationRecord,
  NotificationsRepository,
} from '../../src/modules/notifications/notifications.types.js';
import type { NotificationListQuery } from '../../src/modules/notifications/notifications.schemas.js';

function notification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    type: 'SYSTEM',
    title: 'Aviso',
    message: 'Mensagem de teste',
    entityType: null,
    entityId: null,
    readAt: null,
    createdAt: new Date('2026-07-20T12:00:00.000Z'),
    ...overrides,
  };
}

class FakeNotificationsRepository implements NotificationsRepository {
  public item: NotificationRecord | null = notification();
  public listResult: NotificationListResult = { items: [this.item], total: 21 };
  public unread = 4;
  public markedAll = 3;
  public lastUserId: string | null = null;
  public lastQuery: NotificationListQuery | null = null;

  public list(userId: string, query: NotificationListQuery): Promise<NotificationListResult> {
    this.lastUserId = userId;
    this.lastQuery = query;
    return Promise.resolve(this.listResult);
  }

  public unreadCount(userId: string): Promise<number> {
    this.lastUserId = userId;
    return Promise.resolve(this.unread);
  }

  public markRead(userId: string, _notificationId: string, _readAt: Date) {
    this.lastUserId = userId;
    return Promise.resolve(this.item);
  }

  public markAllRead(userId: string, _readAt: Date): Promise<number> {
    this.lastUserId = userId;
    return Promise.resolve(this.markedAll);
  }
}

describe('DefaultNotificationsService', () => {
  it('lista somente o usuario informado com paginacao', async () => {
    const repository = new FakeNotificationsRepository();
    const service = new DefaultNotificationsService(repository);
    const userId = randomUUID();
    const query = { page: 2, limit: 10, unreadOnly: true };
    await expect(service.list(userId, query)).resolves.toMatchObject({
      notifications: repository.listResult.items,
      pagination: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
    expect(repository.lastUserId).toBe(userId);
    expect(repository.lastQuery).toEqual(query);
  });

  it('retorna contador e marca todas como lidas', async () => {
    const repository = new FakeNotificationsRepository();
    const service = new DefaultNotificationsService(repository);
    const userId = randomUUID();
    await expect(service.unreadCount(userId)).resolves.toEqual({ unreadCount: 4 });
    await expect(service.markAllRead(userId)).resolves.toEqual({ markedAsRead: 3 });
  });

  it('marca uma notificacao de forma idempotente e preserva o proprietario', async () => {
    const repository = new FakeNotificationsRepository();
    const now = new Date('2026-07-20T13:00:00.000Z');
    const service = new DefaultNotificationsService(repository, () => now);
    const userId = randomUUID();
    await expect(service.markRead(userId, repository.item!.id)).resolves.toEqual({
      notification: repository.item,
    });
    expect(repository.lastUserId).toBe(userId);
  });

  it('retorna 404 quando a notificacao nao pertence ao usuario', async () => {
    const repository = new FakeNotificationsRepository();
    repository.item = null;
    const service = new DefaultNotificationsService(repository);
    await expect(service.markRead(randomUUID(), randomUUID())).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOTIFICATION_NOT_FOUND',
    });
  });
});
