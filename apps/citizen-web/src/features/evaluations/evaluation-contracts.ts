import { z } from 'zod';

const responseMetaSchema = z.object({ requestId: z.string().min(1) });

export const evaluationSchema = z.object({
  id: z.uuid(),
  occurrenceId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  problemResolved: z.boolean(),
  serviceQuality: z.number().int().min(1).max(5).nullable(),
  comment: z.string().nullable(),
  isMine: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const evaluationSummarySchema = z.object({
  occurrenceId: z.uuid(),
  occurrenceStatus: z.string().min(1),
  total: z.number().int().nonnegative(),
  negativeCount: z.number().int().nonnegative(),
  negativePercentage: z.number().min(0).max(100),
  averageRating: z.number().min(0).max(5).nullable(),
  averageServiceQuality: z.number().min(0).max(5).nullable(),
  minimumEvaluationsForContestation: z.number().int().positive(),
  negativeThresholdPercentage: z.number().min(0).max(100),
  eligibleForContestation: z.boolean(),
});

export const evaluationMutationResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    evaluation: evaluationSchema,
    summary: evaluationSummarySchema,
    occurrenceContested: z.boolean(),
  }),
  meta: responseMetaSchema,
});

export const evaluationListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    evaluations: z.array(evaluationSchema),
  }),
  meta: responseMetaSchema.extend({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export const evaluationSummaryResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ summary: evaluationSummarySchema }),
  meta: responseMetaSchema,
});

export interface EvaluationInput {
  rating: number;
  problemResolved: boolean;
  serviceQuality: number | null;
  comment: string | null;
}

export type Evaluation = z.infer<typeof evaluationSchema>;
export type EvaluationSummary = z.infer<typeof evaluationSummarySchema>;
