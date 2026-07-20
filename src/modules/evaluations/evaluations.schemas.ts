import { z } from 'zod';

export const evaluationOccurrenceIdParamsSchema = z.strictObject({ occurrenceId: z.uuid() });

const evaluationFields = {
  rating: z.number().int().min(1).max(5),
  problemResolved: z.boolean(),
  serviceQuality: z.number().int().min(1).max(5).nullable(),
  comment: z.string().trim().min(1).max(1000).nullable(),
};

export const createEvaluationSchema = z.strictObject({
  rating: evaluationFields.rating,
  problemResolved: evaluationFields.problemResolved,
  serviceQuality: evaluationFields.serviceQuality.optional().default(null),
  comment: evaluationFields.comment.optional().default(null),
});

export const updateEvaluationSchema = z
  .strictObject({
    rating: evaluationFields.rating.optional(),
    problemResolved: evaluationFields.problemResolved.optional(),
    serviceQuality: evaluationFields.serviceQuality.optional(),
    comment: evaluationFields.comment.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Informe ao menos um campo para atualizar.',
  });

export const evaluationListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;
export type UpdateEvaluationInput = z.infer<typeof updateEvaluationSchema>;
export type EvaluationListQuery = z.infer<typeof evaluationListQuerySchema>;
