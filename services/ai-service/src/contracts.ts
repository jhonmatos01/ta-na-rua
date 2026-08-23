import { z } from 'zod';

const nearbyOccurrenceSchema = z
  .object({
    id: z.uuid(),
    category: z.string().trim().min(1).max(100).nullable(),
    distanceMeters: z.number().finite().min(0).max(5_000),
    description: z.string().trim().min(1).max(5_000),
    imageUrls: z.array(z.string().trim().min(1).max(2_048)).max(10),
  })
  .strict();

const availableCategorySchema = z
  .object({
    code: z.string().trim().min(1).max(50),
    name: z.string().trim().min(1).max(100),
  })
  .strict();

export const aiServiceRequestSchema = z
  .object({
    analysisType: z.enum([
      'CLASSIFICATION',
      'DUPLICATE_DETECTION',
      'CONTENT_MODERATION',
      'REASSESSMENT',
    ]),
    reportId: z.uuid(),
    imageUrl: z.string().trim().min(1).max(2_048),
    description: z.string().trim().min(1).max(5_000),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    nearbyOccurrences: z.array(nearbyOccurrenceSchema).max(50),
    availableCategories: z.array(availableCategorySchema).min(1).max(100),
  })
  .strict();

export const aiServiceResponseSchema = z
  .object({
    category: z.string().trim().min(1).max(50),
    subcategory: z.string().trim().min(1).max(100).nullable(),
    severity: z.number().int().min(1).max(5),
    risk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    confidence: z.number().finite().min(0).max(1),
    summary: z.string().trim().min(1).max(2_000),
    requiresHumanReview: z.boolean(),
    possibleDuplicates: z
      .array(
        z
          .object({
            occurrenceId: z.uuid(),
            similarity: z.number().finite().min(0).max(1),
            reason: z.string().trim().min(1).max(500),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

export type AiServiceRequest = z.infer<typeof aiServiceRequestSchema>;
export type AiServiceResponse = z.infer<typeof aiServiceResponseSchema>;
