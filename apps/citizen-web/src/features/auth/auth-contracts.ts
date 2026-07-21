import { z } from 'zod';

const metaSchema = z.object({ requestId: z.string().min(1) });
const nullableDateSchema = z.iso.datetime().nullable();

export const authUserSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
  phone: z.string().nullable(),
  role: z.enum(['CITIZEN', 'CITY_OPERATOR', 'MODERATOR', 'ADMIN']),
  municipalityId: z.uuid().nullable(),
  neighborhood: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  status: z.enum(['PENDING', 'ACTIVE', 'BLOCKED', 'DELETED']),
  emailVerifiedAt: nullableDateSchema,
  lastLoginAt: nullableDateSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: nullableDateSchema,
});

export const sessionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    accessToken: z.string().min(1),
    tokenType: z.literal('Bearer'),
    expiresIn: z.number().int().positive(),
    user: authUserSchema,
  }),
  meta: metaSchema,
});

export const userResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ user: authUserSchema }),
  meta: metaSchema,
});

export type AuthUser = z.infer<typeof authUserSchema>;
