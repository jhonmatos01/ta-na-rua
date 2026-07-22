import { z } from 'zod';

const responseMetaSchema = z.object({ requestId: z.string().min(1) });

export const confirmationMutationResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    confirmation: z.object({
      id: z.uuid(),
      occurrenceId: z.uuid(),
      directlyAffected: z.boolean(),
      problemWorsened: z.boolean(),
      comment: z.string().nullable(),
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime(),
    }),
    occurrence: z.object({
      confirmationCount: z.number().int().nonnegative(),
      priorityScore: z.number().min(0).max(100),
    }),
  }),
  meta: responseMetaSchema,
});

export const confirmationStateResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    occurrenceId: z.uuid(),
    confirmationCount: z.number().int().nonnegative(),
    priorityScore: z.number().min(0).max(100),
    confirmedByMe: z.boolean().optional(),
  }),
  meta: responseMetaSchema,
});

export type ConfirmationState = z.infer<typeof confirmationStateResponseSchema>['data'];
export type ConfirmationMutationResult = z.infer<typeof confirmationMutationResponseSchema>['data'];
