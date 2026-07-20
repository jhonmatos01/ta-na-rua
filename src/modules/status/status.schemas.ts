import { z } from 'zod';

import { occurrenceStatusValues } from '../../database/schema/enums.js';

const optionalMessage = z.string().trim().min(1).max(2000).nullable().optional();

export const statusOccurrenceIdParamsSchema = z.strictObject({ occurrenceId: z.uuid() });

export const updateOccurrenceStatusSchema = z.strictObject({
  status: z.enum(occurrenceStatusValues),
  reason: optionalMessage,
  publicMessage: optionalMessage,
  departmentId: z.uuid().optional(),
  expectedResolutionAt: z.coerce.date().optional(),
  scheduledFor: z.coerce.date().optional(),
  resolutionDescription: z.string().trim().min(3).max(2000).optional(),
  duplicateOfOccurrenceId: z.uuid().optional(),
});

export const updateOccurrenceAssignmentSchema = z.strictObject({
  departmentId: z.uuid(),
  expectedResolutionAt: z.coerce.date().optional(),
  reason: optionalMessage,
  publicMessage: optionalMessage,
});

export type UpdateOccurrenceStatusInput = z.infer<typeof updateOccurrenceStatusSchema>;
export type UpdateOccurrenceAssignmentInput = z.infer<typeof updateOccurrenceAssignmentSchema>;
