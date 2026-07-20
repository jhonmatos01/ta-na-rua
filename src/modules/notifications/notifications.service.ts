import { AppError } from '../../shared/errors/app-error.js';
import type { NotificationListQuery } from './notifications.schemas.js';
import type { NotificationsRepository, NotificationsService } from './notifications.types.js';

export class DefaultNotificationsService implements NotificationsService {
  public constructor(
    private readonly repository: NotificationsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(userId: string, query: NotificationListQuery): Promise<unknown> {
    const result = await this.repository.list(userId, query);
    return {
      notifications: result.items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  public async unreadCount(userId: string): Promise<unknown> {
    return { unreadCount: await this.repository.unreadCount(userId) };
  }

  public async markRead(userId: string, notificationId: string): Promise<unknown> {
    const notification = await this.repository.markRead(userId, notificationId, this.now());
    if (notification === null) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notificacao nao encontrada.');
    }
    return { notification };
  }

  public async markAllRead(userId: string): Promise<unknown> {
    return { markedAsRead: await this.repository.markAllRead(userId, this.now()) };
  }
}
