import { z } from 'zod';

export const confirmationOccurrenceIdParamsSchema = z.strictObject({
  occurrenceId: z.uuid(),
});

export const createConfirmationSchema = z.strictObject({
  directlyAffected: z.boolean().default(false),
  problemWorsened: z.boolean().default(false),
  comment: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export type CreateConfirmationInput = z.infer<typeof createConfirmationSchema>;
