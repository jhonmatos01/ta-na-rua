import { z } from 'zod';

import { apiRequest } from '../../lib/http-client';

const metaSchema = z.object({
  requestId: z.string().min(1),
});

export const apiHealthSchema = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.literal('ok'),
    timestamp: z.iso.datetime(),
  }),
  meta: metaSchema,
});

export const databaseHealthSchema = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.literal('connected'),
    postgisVersion: z.string().min(1),
    responseTimeMs: z.number().nonnegative(),
  }),
  meta: metaSchema,
});

export type ApiHealth = z.infer<typeof apiHealthSchema>;
export type DatabaseHealth = z.infer<typeof databaseHealthSchema>;

export function getApiHealth(signal?: AbortSignal): Promise<ApiHealth> {
  return apiRequest('/health', { schema: apiHealthSchema, signal });
}

export function getDatabaseHealth(signal?: AbortSignal): Promise<DatabaseHealth> {
  return apiRequest('/health/database', { schema: databaseHealthSchema, signal });
}
