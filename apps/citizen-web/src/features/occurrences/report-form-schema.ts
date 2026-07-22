import { z } from 'zod';

import { env } from '../../config/env';

const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const optionalTrimmedText = (maxLength: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
    z.string().trim().max(maxLength).optional(),
  );

export const reportDetailsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Informe um título com pelo menos 3 caracteres.')
    .max(150, 'Use no máximo 150 caracteres no título.'),
  description: optionalTrimmedText(2000),
  categoryId: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.uuid('Selecione uma categoria válida.').optional(),
  ),
  image: z
    .instanceof(File, { message: 'Adicione uma foto do problema.' })
    .refine((file) => supportedImageTypes.has(file.type), {
      message: 'Use uma imagem JPEG, PNG ou WebP.',
    })
    .refine((file) => file.size <= env.maxImageSizeMb * 1024 * 1024, {
      message: `A imagem deve ter no máximo ${env.maxImageSizeMb} MB.`,
    }),
});

export const reportLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationAccuracy: z.number().min(0).optional(),
  neighborhoodText: optionalTrimmedText(150),
  address: optionalTrimmedText(500),
});

export interface ReportFieldErrors {
  title?: string;
  description?: string;
  categoryId?: string;
  image?: string;
  latitude?: string;
  longitude?: string;
  locationAccuracy?: string;
  neighborhoodText?: string;
  address?: string;
}

const reportFieldNames = new Set<keyof ReportFieldErrors>([
  'title',
  'description',
  'categoryId',
  'image',
  'latitude',
  'longitude',
  'locationAccuracy',
  'neighborhoodText',
  'address',
]);

function isReportFieldName(value: unknown): value is keyof ReportFieldErrors {
  return typeof value === 'string' && reportFieldNames.has(value as keyof ReportFieldErrors);
}

export function reportFieldErrors(error: z.ZodError): ReportFieldErrors {
  const fields: ReportFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (isReportFieldName(field) && fields[field] === undefined) fields[field] = issue.message;
  }
  return fields;
}

export type ReportDetails = z.infer<typeof reportDetailsSchema>;
export type ReportLocation = z.infer<typeof reportLocationSchema>;
