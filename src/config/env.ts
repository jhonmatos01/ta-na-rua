import 'dotenv/config';

import { z } from 'zod';

const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.url().optional(),
);
const optionalSecret = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(32).optional(),
);

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3333),
  DATABASE_URL: z
    .string()
    .trim()
    .regex(/^postgres(?:ql)?:\/\//u, 'deve ser uma URL PostgreSQL valida'),
  CORS_ORIGIN: z.url().default('http://localhost:5173'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  JSON_BODY_LIMIT: z.string().trim().min(1).default('1mb'),
  API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100_000).default(300),
  API_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3_600).default(60),
  GEOCODING_PROVIDER_URL: optionalUrl,
  GEOCODING_PROVIDER_NAME: z.string().trim().min(1).max(100).default('OpenStreetMap'),
  GEOCODING_ATTRIBUTION_TEXT: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .default('© OpenStreetMap contributors'),
  GEOCODING_ATTRIBUTION_URL: z.url().default('https://www.openstreetmap.org/copyright'),
  GEOCODING_USER_AGENT: z
    .string()
    .trim()
    .min(10)
    .max(300)
    .default('TaNaRua/1.0 (+https://github.com/jhonmatos01/ta-na-rua)'),
  GEOCODING_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5_000),
  GEOCODING_CACHE_TTL_SECONDS: z.coerce.number().int().min(60).max(2_592_000).default(86_400),
  GEOCODING_CACHE_MAX_ENTRIES: z.coerce.number().int().min(10).max(100_000).default(10_000),
  GEOCODING_MIN_INTERVAL_MS: z.coerce.number().int().min(1_000).max(60_000).default(1_000),
  GEOCODING_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1_000).default(10),
  GEOCODING_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3_600).default(60),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32)
    .default('local-development-secret-change-this-before-production'),
  JWT_ISSUER: z.string().trim().min(1).default('ta-na-rua-api'),
  JWT_AUDIENCE: z.string().trim().min(1).default('ta-na-rua-web'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).max(128).default(12),
  MAX_IMAGES_PER_OCCURRENCE: z.coerce.number().int().min(1).max(20).default(5),
  MAX_IMAGE_SIZE_MB: z.coerce.number().int().min(1).max(25).default(8),
  DUPLICATE_RADIUS_METERS: z.coerce.number().int().min(1).max(10_000).default(30),
  DUPLICATE_PERIOD_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  DEFAULT_PAGE_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  MAX_PAGE_SIZE: z.coerce.number().int().min(1).max(100).default(100),
  MUNICIPALITY_MAX_DISTANCE_METERS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(500_000)
    .default(100_000),
  EVALUATION_EDIT_WINDOW_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  EVALUATION_NEGATIVE_THRESHOLD: z.coerce.number().min(0.01).max(1).default(0.5),
  EVALUATION_MIN_COUNT_FOR_CONTESTATION: z.coerce.number().int().min(1).max(100).default(3),
  AI_SERVICE_URL: optionalUrl,
  AI_SERVICE_SECRET: optionalTrimmedString,
  AI_MODEL_NAME: z.string().trim().min(1).max(150).default('external-ai-service'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(8_000),
  AI_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(3).default(2),
  AI_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.75),
  AI_DUPLICATE_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.8),
  TELEGRAM_WEBHOOK_SECRET: optionalSecret,
  WHATSAPP_WEBHOOK_SECRET: optionalSecret,
  N8N_WEBHOOK_SECRET: optionalSecret,
  N8N_WEBHOOK_URL: optionalUrl,
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS: z.coerce.number().int().min(30).max(3_600).default(300),
  WEBHOOK_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(30),
  WEBHOOK_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3_600).default(60),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(3),
  OUTBOX_RETRY_BASE_SECONDS: z.coerce.number().int().min(1).max(3_600).default(30),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).max(300_000).default(5_000),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIRECTORY: z.string().trim().min(1).default('tmp/uploads'),
  STORAGE_PUBLIC_BASE_URL: z.string().trim().min(1).default('/uploads'),
  STORAGE_BUCKET: optionalTrimmedString,
  STORAGE_REGION: z.string().trim().min(1).default('us-east-1'),
  STORAGE_ENDPOINT: optionalUrl,
  STORAGE_ACCESS_KEY: optionalTrimmedString,
  STORAGE_SECRET_KEY: optionalTrimmedString,
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(source: NodeJS.ProcessEnv): Environment {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'ambiente'}: ${issue.message}`)
      .join('; ');

    throw new Error(`Variaveis de ambiente invalidas: ${issues}`);
  }

  if (
    result.data.NODE_ENV === 'production' &&
    result.data.JWT_ACCESS_SECRET === 'local-development-secret-change-this-before-production'
  ) {
    throw new Error(
      'Variaveis de ambiente invalidas: JWT_ACCESS_SECRET deve ser definida em producao.',
    );
  }

  if (result.data.NODE_ENV === 'production') {
    const productionSecrets = [
      result.data.JWT_ACCESS_SECRET,
      result.data.AI_SERVICE_SECRET,
      result.data.TELEGRAM_WEBHOOK_SECRET,
      result.data.WHATSAPP_WEBHOOK_SECRET,
      result.data.N8N_WEBHOOK_SECRET,
      result.data.STORAGE_ACCESS_KEY,
      result.data.STORAGE_SECRET_KEY,
    ].filter((value): value is string => value !== undefined);
    if (productionSecrets.some((value) => /change[_-]?me|replace[_-]?with/iu.test(value))) {
      throw new Error(
        'Variaveis de ambiente invalidas: substitua todos os placeholders de segredo antes da producao.',
      );
    }
  }

  if (
    result.data.NODE_ENV === 'production' &&
    new URL(result.data.CORS_ORIGIN).protocol !== 'https:'
  ) {
    throw new Error('Variaveis de ambiente invalidas: CORS_ORIGIN deve usar HTTPS em producao.');
  }

  if (
    result.data.NODE_ENV === 'production' &&
    result.data.GEOCODING_PROVIDER_URL !== undefined &&
    new URL(result.data.GEOCODING_PROVIDER_URL).protocol !== 'https:'
  ) {
    throw new Error(
      'Variaveis de ambiente invalidas: GEOCODING_PROVIDER_URL deve usar HTTPS em producao.',
    );
  }

  if (
    result.data.NODE_ENV === 'production' &&
    result.data.GEOCODING_PROVIDER_URL !== undefined &&
    new URL(result.data.GEOCODING_PROVIDER_URL).hostname === 'nominatim.openstreetmap.org'
  ) {
    throw new Error(
      'Variaveis de ambiente invalidas: use uma instancia dedicada de geocodificacao em producao.',
    );
  }

  if (
    result.data.STORAGE_PROVIDER === 's3' &&
    (result.data.STORAGE_BUCKET === undefined ||
      result.data.STORAGE_ACCESS_KEY === undefined ||
      result.data.STORAGE_SECRET_KEY === undefined)
  ) {
    throw new Error(
      'Variaveis de ambiente invalidas: STORAGE_BUCKET, STORAGE_ACCESS_KEY e STORAGE_SECRET_KEY sao obrigatorias com STORAGE_PROVIDER=s3.',
    );
  }

  if (
    result.data.STORAGE_PROVIDER === 's3' &&
    !/^https?:\/\//u.test(result.data.STORAGE_PUBLIC_BASE_URL)
  ) {
    throw new Error(
      'Variaveis de ambiente invalidas: STORAGE_PUBLIC_BASE_URL deve ser uma URL HTTP(S) absoluta com STORAGE_PROVIDER=s3.',
    );
  }

  if (
    (result.data.AI_SERVICE_URL === undefined) !==
    (result.data.AI_SERVICE_SECRET === undefined)
  ) {
    throw new Error(
      'Variaveis de ambiente invalidas: AI_SERVICE_URL e AI_SERVICE_SECRET devem ser definidas em conjunto.',
    );
  }

  if (
    result.data.NODE_ENV === 'production' &&
    (result.data.AI_SERVICE_URL === undefined || result.data.AI_SERVICE_SECRET === undefined)
  ) {
    throw new Error(
      'Variaveis de ambiente invalidas: AI_SERVICE_URL e AI_SERVICE_SECRET sao obrigatorias em producao.',
    );
  }

  if (
    result.data.NODE_ENV === 'production' &&
    (result.data.TELEGRAM_WEBHOOK_SECRET === undefined ||
      result.data.WHATSAPP_WEBHOOK_SECRET === undefined ||
      result.data.N8N_WEBHOOK_SECRET === undefined ||
      result.data.N8N_WEBHOOK_URL === undefined)
  ) {
    throw new Error(
      'Variaveis de ambiente invalidas: segredos dos webhooks e N8N_WEBHOOK_URL sao obrigatorios em producao.',
    );
  }

  if (result.data.NODE_ENV === 'production') {
    const webhookSecrets = [
      result.data.TELEGRAM_WEBHOOK_SECRET!,
      result.data.WHATSAPP_WEBHOOK_SECRET!,
      result.data.N8N_WEBHOOK_SECRET!,
    ];
    if (new Set(webhookSecrets).size !== webhookSecrets.length) {
      throw new Error(
        'Variaveis de ambiente invalidas: cada integracao deve usar um segredo de webhook exclusivo.',
      );
    }
  }

  if (result.data.NODE_ENV === 'production' && result.data.STORAGE_PROVIDER !== 's3') {
    throw new Error('Variaveis de ambiente invalidas: STORAGE_PROVIDER deve ser s3 em producao.');
  }

  return result.data;
}

export const env = Object.freeze(parseEnvironment(process.env));
