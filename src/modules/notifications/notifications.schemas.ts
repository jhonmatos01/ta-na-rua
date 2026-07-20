import { z } from 'zod';

import { notificationTypeValues } from '../../database/schema/enums.js';

const optionalBoolean = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean().optional());

export const notificationListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: optionalBoolean.default(false),
  type: z.enum(notificationTypeValues).optional(),
});

export const notificationIdParamsSchema = z.strictObject({
  id: z.uuid(),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
