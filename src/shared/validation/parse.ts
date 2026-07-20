import type { z } from 'zod';

import { AppError } from '../errors/app-error.js';

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Os dados enviados sao invalidos.', {
      fields: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  return result.data;
}
