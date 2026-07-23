import { z } from 'zod';

export const notificationTypeSchema = z.enum([
  'OCCURRENCE_CREATED',
  'STATUS_CHANGED',
  'OCCURRENCE_CONFIRMED',
  'OCCURRENCE_DUPLICATE',
  'REPAIR_EVALUATION_REQUESTED',
  'SYSTEM',
]);

export const notificationSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  type: notificationTypeSchema,
  title: z.string().min(1),
  message: z.string().min(1),
  entityType: z.string().nullable(),
  entityId: z.uuid().nullable(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

const metaSchema = z.object({ requestId: z.string().min(1) });

export const notificationListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    notifications: z.array(notificationSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  }),
  meta: metaSchema,
});

export const unreadCountResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ unreadCount: z.number().int().nonnegative() }),
  meta: metaSchema,
});

export const markNotificationReadResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ notification: notificationSchema }),
  meta: metaSchema,
});

export const markAllNotificationsReadResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ markedAsRead: z.number().int().nonnegative() }),
  meta: metaSchema,
});

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type CitizenNotification = z.infer<typeof notificationSchema>;
