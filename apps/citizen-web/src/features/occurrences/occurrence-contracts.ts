import { z } from 'zod';

export const occurrenceStatusSchema = z.enum([
  'PENDING_REVIEW',
  'PUBLISHED',
  'FORWARDED',
  'ACKNOWLEDGED',
  'UNDER_ANALYSIS',
  'SCHEDULED',
  'IN_PROGRESS',
  'RESOLVED',
  'CONTESTED',
  'CLOSED',
  'REJECTED',
  'DUPLICATE',
]);

export const riskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const referenceSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).nullable(),
});

const imageSchema = z.object({
  id: z.uuid(),
  url: z.string().min(1),
  mimeType: z.string().min(1),
  imageType: z.string().min(1),
  moderationStatus: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export const publicOccurrenceSchema = z.object({
  id: z.uuid(),
  protocol: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  category: referenceSchema.nullable(),
  municipality: referenceSchema,
  neighborhood: z.union([referenceSchema, z.string().min(1)]).nullable(),
  status: occurrenceStatusSchema,
  severity: z.number().nullable(),
  priorityScore: z.number().min(0).max(100),
  riskLevel: riskLevelSchema.nullable(),
  confirmationCount: z.number().int().nonnegative(),
  anonymousPublication: z.boolean(),
  images: z.array(imageSchema),
  firstReportedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  distanceMeters: z.number().nonnegative().optional(),
  address: z.string().nullable(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    approximate: z.literal(true),
  }),
});

export const mapPointSchema = z.object({
  id: z.uuid(),
  protocol: z.string().min(1),
  title: z.string().min(1),
  status: occurrenceStatusSchema,
  category: z.string().nullable(),
  riskLevel: riskLevelSchema.nullable(),
  confirmationCount: z.number().int().nonnegative(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const responseMetaSchema = z.object({ requestId: z.string().min(1) });

export const occurrenceListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ occurrences: z.array(publicOccurrenceSchema) }),
  meta: responseMetaSchema.extend({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export const occurrenceMapResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ points: z.array(mapPointSchema) }),
  meta: responseMetaSchema,
});

export const occurrenceDetailResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ occurrence: publicOccurrenceSchema }),
  meta: responseMetaSchema,
});

const detailedLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable().optional(),
  approximate: z.literal(false),
});

export const createdOccurrenceSchema = publicOccurrenceSchema.omit({ location: true }).extend({
  createdBy: z.uuid(),
  location: detailedLocationSchema,
  nearbyCandidates: z
    .array(
      z.object({
        id: z.uuid(),
        protocol: z.string().min(1),
        title: z.string().min(1),
        status: occurrenceStatusSchema,
      }),
    )
    .default([]),
  aiAnalysis: z.unknown().optional(),
});

export const createOccurrenceResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ occurrence: createdOccurrenceSchema }),
  meta: responseMetaSchema,
});

export const confirmationResponseSchema = z.object({
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

export const timelineItemSchema = z.object({
  id: z.uuid(),
  previousStatus: occurrenceStatusSchema.nullable(),
  newStatus: occurrenceStatusSchema,
  publicMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const occurrenceTimelineResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ timeline: z.array(timelineItemSchema) }),
  meta: responseMetaSchema,
});

export type OccurrenceStatus = z.infer<typeof occurrenceStatusSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type PublicOccurrence = z.infer<typeof publicOccurrenceSchema>;
export type CreatedOccurrence = z.infer<typeof createdOccurrenceSchema>;
export type MapPoint = z.infer<typeof mapPointSchema>;
export type TimelineItem = z.infer<typeof timelineItemSchema>;
