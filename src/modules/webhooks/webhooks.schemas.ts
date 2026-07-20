import { z } from 'zod';

import { occurrenceStatusValues } from '../../database/schema/enums.js';

const eventId = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9._:-]+$/u);
const occurredAt = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const baseEnvelope = {
  externalEventId: eventId,
  occurredAt,
};

export const reportWebhookSchema = z.strictObject({
  ...baseEnvelope,
  eventType: z.literal('REPORT_RECEIVED'),
  data: z.strictObject({
    municipalityId: z.uuid(),
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().min(3).max(5_000).optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    imageUrl: z.url().max(2_048).optional(),
  }),
});

export const statusWebhookSchema = z.strictObject({
  ...baseEnvelope,
  eventType: z.literal('OCCURRENCE_STATUS_UPDATE'),
  data: z.strictObject({
    occurrenceId: z.uuid(),
    status: z.enum(occurrenceStatusValues),
    reason: z.string().trim().min(3).max(1_000).optional(),
    publicMessage: z.string().trim().min(3).max(1_000).optional(),
  }),
});

export const n8nCallbackWebhookSchema = z.strictObject({
  ...baseEnvelope,
  eventType: z.literal('OUTBOX_DELIVERY_CALLBACK'),
  data: z.strictObject({
    outboxEventId: z.uuid(),
    deliveryStatus: z.enum(['PROCESSED', 'FAILED']),
    errorMessage: z.string().trim().min(1).max(500).optional(),
  }),
});

export type ReportWebhookInput = z.infer<typeof reportWebhookSchema>;
export type StatusWebhookInput = z.infer<typeof statusWebhookSchema>;
export type N8nCallbackWebhookInput = z.infer<typeof n8nCallbackWebhookSchema>;
export type WebhookInput = ReportWebhookInput | StatusWebhookInput | N8nCallbackWebhookInput;
