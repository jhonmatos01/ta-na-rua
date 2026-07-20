import { z } from 'zod';

import { env } from '../../config/env.js';

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(env.PASSWORD_MIN_LENGTH).max(128);
const phone = z.string().trim().min(10).max(24);

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    email,
    phone: phone.optional(),
    password,
    municipalityId: z.uuid(),
    neighborhood: z.string().trim().min(1).max(150).optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1).max(128),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: password,
  })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'A nova senha deve ser diferente da senha atual.',
    path: ['newPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
