import type { notificationTypeValues } from '../../database/schema/enums.js';
import type { NotificationListQuery } from './notifications.schemas.js';

export type NotificationType = (typeof notificationTypeValues)[number];

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationListResult {
  items: NotificationRecord[];
  total: number;
}

export interface NotificationsRepository {
  list(userId: string, query: NotificationListQuery): Promise<NotificationListResult>;
  unreadCount(userId: string): Promise<number>;
  markRead(
    userId: string,
    notificationId: string,
    readAt: Date,
  ): Promise<NotificationRecord | null>;
  markAllRead(userId: string, readAt: Date): Promise<number>;
}

export interface NotificationsService {
  list(userId: string, query: NotificationListQuery): Promise<unknown>;
  unreadCount(userId: string): Promise<unknown>;
  markRead(userId: string, notificationId: string): Promise<unknown>;
  markAllRead(userId: string): Promise<unknown>;
}
