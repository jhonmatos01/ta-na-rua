import { z } from 'zod';

export const aiPossibleDuplicateSchema = z.strictObject({
  occurrenceId: z.uuid(),
  similarity: z.number().min(0).max(1),
  reason: z.string().trim().min(1).max(500),
});

export const aiServiceResponseSchema = z.strictObject({
  category: z.string().trim().min(1).max(50),
  subcategory: z.string().trim().min(1).max(100).nullable(),
  severity: z.number().int().min(1).max(5),
  risk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  confidence: z.number().min(0).max(1),
  summary: z.string().trim().min(1).max(2_000),
  requiresHumanReview: z.boolean(),
  possibleDuplicates: z.array(aiPossibleDuplicateSchema).max(10),
});

export const aiInternalOccurrenceSchema = z.strictObject({
  occurrenceId: z.uuid(),
});

export type AiServiceResponse = z.infer<typeof aiServiceResponseSchema>;
export type AiPossibleDuplicate = z.infer<typeof aiPossibleDuplicateSchema>;
export type AiInternalOccurrenceInput = z.infer<typeof aiInternalOccurrenceSchema>;
