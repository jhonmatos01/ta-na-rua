import { z } from 'zod';

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    AI_SERVICE_HOST: z.string().trim().min(1).default('127.0.0.1'),
    AI_SERVICE_PORT: z.coerce.number().int().min(1).max(65_535).default(8_000),
    AI_SERVICE_MODE: z.literal('DETERMINISTIC').default('DETERMINISTIC'),
    AI_SERVICE_SECRET: z.string().min(32),
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

    return {
      nodeEnv: environment.NODE_ENV,
      host: environment.AI_SERVICE_HOST,
      port: environment.AI_SERVICE_PORT,
      mode: environment.AI_SERVICE_MODE,
      secret: environment.AI_SERVICE_SECRET,
    };
  });

export type AiServiceConfig = z.infer<typeof environmentSchema>;

export function parseAiServiceConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AiServiceConfig {
  return environmentSchema.parse(environment);
}
