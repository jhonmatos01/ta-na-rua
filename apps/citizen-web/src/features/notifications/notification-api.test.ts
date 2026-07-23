import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { env } from '../../config/env';
import { setAccessToken } from '../../lib/auth-session';
import { server } from '../../tests/server';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from './notification-api';

const notification = {
  id: '71000000-0000-4000-8000-000000000001',
  userId: '50000000-0000-4000-8000-000000000001',
  type: 'STATUS_CHANGED',
  title: 'Ocorrência em análise',
  message: 'A equipe iniciou a análise.',
  entityType: 'occurrence',
  entityId: '30000000-0000-4000-8000-000000000001',
  readAt: null,
  createdAt: '2026-07-22T12:00:00.000Z',
} as const;

beforeEach(() => setAccessToken('notification-test-token'));

describe('API de notificações', () => {
  it('envia filtros paginados e autenticação', async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/notifications`, ({ request }) => {
        const url = new URL(request.url);
        expect(request.headers.get('authorization')).toBe('Bearer notification-test-token');
        expect(url.searchParams.get('page')).toBe('2');
        expect(url.searchParams.get('limit')).toBe('8');
        expect(url.searchParams.get('unreadOnly')).toBe('true');
        return HttpResponse.json({
          success: true,
          data: {
            notifications: [notification],
            pagination: { page: 2, limit: 8, total: 9, totalPages: 2 },
          },
          meta: { requestId: 'notification-list' },
        });
      }),
    );

    const result = await getNotifications({ page: 2, limit: 8, unreadOnly: true });
    expect(result.notifications[0]).toMatchObject({ title: 'Ocorrência em análise' });
    expect(result.pagination).toEqual({ page: 2, limit: 8, total: 9, totalPages: 2 });
  });

  it('consulta contador e executa as duas ações de leitura', async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/notifications/unread-count`, () =>
        HttpResponse.json({
          success: true,
          data: { unreadCount: 3 },
          meta: { requestId: 'notification-count' },
        }),
      ),
      http.patch(`${env.apiBaseUrl}/api/v1/notifications/:notificationId/read`, () =>
        HttpResponse.json({
          success: true,
          data: { notification: { ...notification, readAt: '2026-07-22T12:10:00.000Z' } },
          meta: { requestId: 'notification-read' },
        }),
      ),
      http.patch(`${env.apiBaseUrl}/api/v1/notifications/read-all`, () =>
        HttpResponse.json({
          success: true,
          data: { markedAsRead: 3 },
          meta: { requestId: 'notification-read-all' },
        }),
      ),
    );

    await expect(getUnreadNotificationCount()).resolves.toBe(3);
    await expect(markNotificationRead(notification.id)).resolves.toMatchObject({
      readAt: '2026-07-22T12:10:00.000Z',
    });
    await expect(markAllNotificationsRead()).resolves.toBe(3);
  });
});
