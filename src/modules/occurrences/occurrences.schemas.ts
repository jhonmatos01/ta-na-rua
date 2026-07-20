import { z } from 'zod';

import { env } from '../../config/env.js';
import { occurrenceStatusValues, riskLevelValues } from '../../database/schema/enums.js';

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );

const optionalUuid = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.uuid().optional(),
);

const multipartBoolean = z.preprocess((value) => {
  if (value === 'true' || value === '1' || value === true) return true;
  if (value === 'false' || value === '0' || value === false) return false;
  return value;
}, z.boolean());

export const occurrenceIdParamsSchema = z.strictObject({ occurrenceId: z.uuid() });

export const createOccurrenceSchema = z.strictObject({
  title: z.string().trim().min(3).max(150),
  description: optionalText(2000),
  categoryId: optionalUuid,
  municipalityId: z.uuid(),
  neighborhoodId: optionalUuid,
  neighborhoodText: optionalText(150),
  address: optionalText(500),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  locationAccuracy: z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.coerce.number().min(0).max(100_000).optional(),
  ),
  anonymousPublication: z.preprocess(
    (value) => (value === undefined || value === '' ? false : value),
    multipartBoolean,
  ),
});

export const updateOccurrenceSchema = z
  .strictObject({
    title: z.string().trim().min(3).max(150).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    neighborhoodText: z.string().trim().max(150).nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
    anonymousPublication: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Informe ao menos um campo para atualizar.',
  });

const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(env.MAX_PAGE_SIZE)
  .default(env.DEFAULT_PAGE_SIZE);

export const occurrenceListQuerySchema = z.strictObject({
  municipalityId: optionalUuid,
  neighborhood: optionalText(150),
  category: optionalText(140),
  status: z.enum(occurrenceStatusValues).optional(),
  risk: z.enum(riskLevelValues).optional(),
  priority: z.coerce.number().min(0).max(100).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().int().min(1).max(50_000).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: pageSchema,
  limit: limitSchema,
});

export const nearbyQuerySchema = z.strictObject({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(1).max(50_000).default(env.DUPLICATE_RADIUS_METERS),
  municipalityId: optionalUuid,
  page: pageSchema,
  limit: limitSchema,
});

export const mapQuerySchema = z.strictObject({
  municipalityId: optionalUuid,
  category: optionalText(140),
  status: z.enum(occurrenceStatusValues).optional(),
  risk: z.enum(riskLevelValues).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

export type CreateOccurrenceInput = z.infer<typeof createOccurrenceSchema>;
export type UpdateOccurrenceInput = z.infer<typeof updateOccurrenceSchema>;
export type OccurrenceListQuery = z.infer<typeof occurrenceListQuerySchema>;
export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;
export type MapQuery = z.infer<typeof mapQuerySchema>;
