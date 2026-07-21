import { z } from 'zod';

import { env } from '../../config/env';

const email = z.email('Informe um e-mail válido.').trim().toLowerCase();
const optionalPhone = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(10, 'Informe um telefone com DDD.').max(24).optional(),
);
const optionalNeighborhood = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).max(150).optional(),
);

export const loginFormSchema = z.object({
  email,
  password: z.string().min(1, 'Informe sua senha.').max(128),
});

export const registerFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome completo.').max(150),
    email,
    phone: optionalPhone,
    neighborhood: optionalNeighborhood,
    password: z
      .string()
      .min(env.passwordMinLength, `Use pelo menos ${env.passwordMinLength} caracteres.`)
      .max(128),
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    message: 'As senhas precisam ser iguais.',
    path: ['passwordConfirmation'],
  });

export const profileFormSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(150),
  phone: optionalPhone,
  neighborhood: optionalNeighborhood,
});

export type FieldErrors = Record<string, string>;

export function getFieldErrors(error: z.ZodError): FieldErrors {
  return error.issues.reduce<FieldErrors>((errors, issue) => {
    const field = String(issue.path[0] ?? 'form');
    errors[field] ??= issue.message;
    return errors;
  }, {});
}
