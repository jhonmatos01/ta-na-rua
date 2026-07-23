import { apiRequest } from '../../lib/http-client';
import {
  markAllNotificationsReadResponseSchema,
  markNotificationReadResponseSchema,
  notificationListResponseSchema,
  unreadCountResponseSchema,
  type NotificationType,
} from './notification-contracts';

export interface NotificationFilters {
  page: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}

export async function getNotifications(filters: NotificationFilters, signal?: AbortSignal) {
  const response = await apiRequest('/api/v1/notifications', {
    query: {
      page: filters.page,
      limit: filters.limit ?? 8,
      unreadOnly: filters.unreadOnly,
      type: filters.type,
    },
    signal,
    schema: notificationListResponseSchema,
    auth: true,
  });
  return response.data;
}

export async function getUnreadNotificationCount(signal?: AbortSignal) {
  const response = await apiRequest('/api/v1/notifications/unread-count', {
    signal,
    schema: unreadCountResponseSchema,
    auth: true,
  });
  return response.data.unreadCount;
}

export async function markNotificationRead(notificationId: string) {
  const response = await apiRequest(`/api/v1/notifications/${notificationId}/read`, {
    method: 'PATCH',
    schema: markNotificationReadResponseSchema,
    auth: true,
  });
  return response.data.notification;
}

export async function markAllNotificationsRead() {
  const response = await apiRequest('/api/v1/notifications/read-all', {
    method: 'PATCH',
    schema: markAllNotificationsReadResponseSchema,
    auth: true,
  });
  return response.data.markedAsRead;
}
