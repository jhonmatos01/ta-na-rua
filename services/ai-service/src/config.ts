import { z } from 'zod';

const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.url().optional(),
);

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    AI_SERVICE_HOST: z.string().trim().min(1).default('127.0.0.1'),
    AI_SERVICE_PORT: z.coerce.number().int().min(1).max(65_535).default(8_000),
    AI_SERVICE_MODE: z
      .enum(['DETERMINISTIC', 'OPENAI_COMPATIBLE'])
      .default('DETERMINISTIC'),
    AI_SERVICE_SECRET: z.string().min(32),
    AI_PROVIDER_BASE_URL: optionalUrl,
    AI_PROVIDER_API_KEY: optionalTrimmedString,
    AI_PROVIDER_MODEL: z.string().trim().min(1).max(200).default('Meu primeiro combo'),
    AI_PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(500).max(120_000).default(60_000),
    AI_PROVIDER_FORCE_HUMAN_REVIEW: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
  })
  .transform((environment, context) => {
    if (
      environment.NODE_ENV === 'production' &&
      environment.AI_SERVICE_MODE === 'DETERMINISTIC'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['AI_SERVICE_MODE'],
        message:
          'O modo DETERMINISTIC é exclusivo de desenvolvimento e não pode iniciar em produção.',
      });

      return z.NEVER;
    }

    if (
      environment.AI_SERVICE_MODE === 'OPENAI_COMPATIBLE' &&
      environment.AI_PROVIDER_BASE_URL === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['AI_PROVIDER_BASE_URL'],
        message: 'A URL base do provedor é obrigatória no modo OPENAI_COMPATIBLE.',
      });
      return z.NEVER;
    }

    if (
      environment.NODE_ENV === 'production' &&
      environment.AI_PROVIDER_BASE_URL !== undefined &&
      new URL(environment.AI_PROVIDER_BASE_URL).protocol !== 'https:'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['AI_PROVIDER_BASE_URL'],
        message: 'A URL do provedor deve usar HTTPS em produção.',
      });
      return z.NEVER;
    }

    return {
      nodeEnv: environment.NODE_ENV,
      host: environment.AI_SERVICE_HOST,
      port: environment.AI_SERVICE_PORT,
      mode: environment.AI_SERVICE_MODE,
      secret: environment.AI_SERVICE_SECRET,
      providerBaseUrl: environment.AI_PROVIDER_BASE_URL,
      providerApiKey: environment.AI_PROVIDER_API_KEY,
      providerModel: environment.AI_PROVIDER_MODEL,
      providerTimeoutMs: environment.AI_PROVIDER_TIMEOUT_MS,
      forceHumanReview: environment.AI_PROVIDER_FORCE_HUMAN_REVIEW,
    };
  });

export type AiServiceConfig = z.infer<typeof environmentSchema>;

export function parseAiServiceConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AiServiceConfig {
  return environmentSchema.parse(environment);
}
