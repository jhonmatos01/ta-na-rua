import { z } from 'zod';

import { userRoleValues, userStatusValues } from '../../database/schema/enums.js';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    phone: z.string().trim().min(10).max(24).nullable().optional(),
    municipalityId: z.uuid().nullable().optional(),
    neighborhood: z.string().trim().min(1).max(150).nullable().optional(),
    avatarUrl: z.url().max(2048).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Informe ao menos um campo para atualizar.',
  });

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  municipalityId: z.uuid().optional(),
  role: z.enum(userRoleValues).optional(),
  status: z.enum(userStatusValues).optional(),
});

export const userIdParamsSchema = z.object({ userId: z.uuid() });
export const updateStatusSchema = z
  .object({ status: z.enum(['ACTIVE', 'PENDING', 'BLOCKED']) })
  .strict();
export const updateRoleSchema = z.object({ role: z.enum(userRoleValues) }).strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
