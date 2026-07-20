import { z } from 'zod';

import { occurrenceStatusValues } from '../../database/schema/enums.js';

const optionalUuid = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.uuid().optional(),
);

const optionalDate = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.date().optional(),
);

const baseFields = {
  municipalityId: optionalUuid,
  categoryId: optionalUuid,
  neighborhoodId: optionalUuid,
  status: z.enum(occurrenceStatusValues).optional(),
  startDate: optionalDate,
  endDate: optionalDate,
};

function validPeriod(value: { startDate?: Date | undefined; endDate?: Date | undefined }): boolean {
  return (
    value.startDate === undefined ||
    value.endDate === undefined ||
    value.endDate.getTime() >= value.startDate.getTime()
  );
}

const periodValidation = {
  path: ['endDate'],
  message: 'A data final deve ser igual ou posterior a data inicial.',
};

export const dashboardQuerySchema = z
  .strictObject(baseFields)
  .refine(validPeriod, periodValidation);

export const priorityRankingQuerySchema = z
  .strictObject({
    ...baseFields,
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine(validPeriod, periodValidation);

export const dashboardExportQuerySchema = z
  .strictObject({
    ...baseFields,
    format: z.enum(['csv']).default('csv'),
    limit: z.coerce.number().int().min(1).max(10_000).default(10_000),
  })
  .refine(validPeriod, periodValidation);

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type PriorityRankingQuery = z.infer<typeof priorityRankingQuerySchema>;
export type DashboardExportQuery = z.infer<typeof dashboardExportQuerySchema>;
