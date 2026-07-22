import { z } from 'zod';

export const reverseGeocodingInputSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();

export const nominatimReverseResponseSchema = z
  .object({
    display_name: z.string().trim().min(1).max(5_000).optional(),
    address: z.record(z.string(), z.unknown()).optional(),
    error: z.string().max(1_000).optional(),
  })
  .passthrough();
