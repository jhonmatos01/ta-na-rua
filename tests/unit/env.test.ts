import { describe, expect, it } from 'vitest';

import { parseEnvironment } from '../../src/config/env.js';

describe('parseEnvironment', () => {
  it('permite piloto seguro sem integracoes e mantem protecoes de producao', () => {
    const pilot = {
      DATABASE_URL: 'postgresql://user:password@localhost:5432/tanarua',
      NODE_ENV: 'production',
      DEPLOYMENT_PROFILE: 'pilot',
      JWT_ACCESS_SECRET: 'a-secure-test-secret-of-at-least-32-characters',
      CORS_ORIGIN: 'https://app.example.test',
      STORAGE_PROVIDER: 's3',
      STORAGE_BUCKET: 'private-bucket',
      STORAGE_PUBLIC_BASE_URL: 'https://storage.example.test',
      STORAGE_ACCESS_KEY: 'test-access',
      STORAGE_SECRET_KEY: 'test-storage-secret',
    };
    expect(parseEnvironment(pilot).AI_SERVICE_URL).toBeUndefined();
    expect(() => parseEnvironment({ ...pilot, STORAGE_PROVIDER: 'local' })).toThrow(
      /STORAGE_PROVIDER deve ser s3/u,
    );
    expect(() => parseEnvironment({ ...pilot, CORS_ORIGIN: 'http://app.example.test' })).toThrow(
      /HTTPS/u,
    );
    expect(() =>
      parseEnvironment({
        ...pilot,
        JWT_ACCESS_SECRET: 'CHANGE_ME_secret_of_at_least_32_characters',
      }),
    ).toThrow(/placeholders/u);
    expect(() =>
      parseEnvironment({ ...pilot, N8N_WEBHOOK_URL: 'https://n8n.example.test' }),
    ).toThrow(/pilot exige integracoes externas desativadas/u);
    expect(() => parseEnvironment({ ...pilot, DEPLOYMENT_PROFILE: 'full' })).toThrow(
      /AI_SERVICE_URL e AI_SERVICE_SECRET sao obrigatorias/u,
    );
  });

  it('aplica os valores padrao seguros', () => {
    const parsed = parseEnvironment({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/tanarua',
    });

    expect(parsed).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3333,
      CORS_ORIGIN: 'http://localhost:5173',
      TRUST_PROXY_HOPS: 0,
      JSON_BODY_LIMIT: '1mb',
      API_RATE_LIMIT_MAX: 300,
      API_RATE_LIMIT_WINDOW_SECONDS: 60,
      LOG_LEVEL: 'info',
      MAX_IMAGES_PER_OCCURRENCE: 5,
      MAX_IMAGE_SIZE_MB: 8,
      EVALUATION_EDIT_WINDOW_DAYS: 7,
      EVALUATION_NEGATIVE_THRESHOLD: 0.5,
      EVALUATION_MIN_COUNT_FOR_CONTESTATION: 3,
      AI_TIMEOUT_MS: 8_000,
      AI_MAX_ATTEMPTS: 2,
      AI_MIN_CONFIDENCE: 0.75,
      AI_DUPLICATE_MIN_SIMILARITY: 0.8,
      WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS: 300,
      WEBHOOK_RATE_LIMIT_MAX: 30,
      OUTBOX_MAX_ATTEMPTS: 3,
      OUTBOX_BATCH_SIZE: 20,
      STORAGE_PROVIDER: 'local',
    });
  });

  it('exige segredos distintos e URL do n8n em producao', () => {
    const base = {
      DATABASE_URL: 'postgresql://user:password@localhost:5432/tanarua',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://app.example.test',
      JWT_ACCESS_SECRET: 'production-secret-with-at-least-thirty-two-characters',
      AI_SERVICE_URL: 'https://ai.example.test',
      AI_SERVICE_SECRET: 'production-ai-secret',
    };
    expect(() => parseEnvironment(base)).toThrowError(/segredos dos webhooks/u);
    expect(
      parseEnvironment({
        ...base,
        TELEGRAM_WEBHOOK_SECRET: 'telegram-production-secret-at-least-32-chars',
        WHATSAPP_WEBHOOK_SECRET: 'whatsapp-production-secret-at-least-32-chars',
        N8N_WEBHOOK_SECRET: 'n8n-production-secret-at-least-32-characters',
        N8N_WEBHOOK_URL: 'https://n8n.example.test/webhook',
        STORAGE_PROVIDER: 's3',
        STORAGE_BUCKET: 'production-bucket',
        STORAGE_ACCESS_KEY: 'production-access-key',
        STORAGE_SECRET_KEY: 'production-storage-secret',
        STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.test',
      }).N8N_WEBHOOK_URL,
    ).toBe('https://n8n.example.test/webhook');
  });

  it('exige CORS HTTPS, storage S3 e segredos de webhook exclusivos em producao', () => {
    const production = {
      DATABASE_URL: 'postgresql://user:password@localhost:5432/tanarua',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://app.example.test',
      JWT_ACCESS_SECRET: 'production-secret-with-at-least-thirty-two-characters',
      AI_SERVICE_URL: 'https://ai.example.test',
      AI_SERVICE_SECRET: 'production-ai-secret',
      TELEGRAM_WEBHOOK_SECRET: 'shared-production-webhook-secret-at-least-32',
      WHATSAPP_WEBHOOK_SECRET: 'shared-production-webhook-secret-at-least-32',
      N8N_WEBHOOK_SECRET: 'n8n-production-secret-at-least-32-characters',
      N8N_WEBHOOK_URL: 'https://n8n.example.test/webhook',
      STORAGE_PROVIDER: 's3',
      STORAGE_BUCKET: 'production-bucket',
      STORAGE_ACCESS_KEY: 'production-access-key',
      STORAGE_SECRET_KEY: 'production-storage-secret',
      STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.test',
    };

    expect(() => parseEnvironment(production)).toThrowError(/segredo de webhook exclusivo/u);
    expect(() =>
      parseEnvironment({
        ...production,
        CORS_ORIGIN: 'http://app.example.test',
        WHATSAPP_WEBHOOK_SECRET: 'whatsapp-production-secret-at-least-32-chars',
      }),
    ).toThrowError(/CORS_ORIGIN deve usar HTTPS/u);
    expect(() =>
      parseEnvironment({
        ...production,
        WHATSAPP_WEBHOOK_SECRET: 'whatsapp-production-secret-at-least-32-chars',
        STORAGE_PROVIDER: 'local',
      }),
    ).toThrowError(/STORAGE_PROVIDER deve ser s3/u);
  });

  it('rejeita placeholders de segredo em producao', () => {
    expect(() =>
      parseEnvironment({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/tanarua',
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.example.test',
        JWT_ACCESS_SECRET: 'CHANGE_ME_WITH_AT_LEAST_32_RANDOM_CHARACTERS',
      }),
    ).toThrowError(/substitua todos os placeholders/u);
  });

  it('exige URL e segredo da IA em conjunto e em producao', () => {
    const database = 'postgresql://user:password@localhost:5432/tanarua';
    expect(() =>
      parseEnvironment({ DATABASE_URL: database, AI_SERVICE_URL: 'http://localhost:8000' }),
    ).toThrowError(/AI_SERVICE_URL e AI_SERVICE_SECRET/u);
    expect(() =>
      parseEnvironment({
        DATABASE_URL: database,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.example.test',
        JWT_ACCESS_SECRET: 'production-secret-with-at-least-thirty-two-characters',
      }),
    ).toThrowError(/obrigatorias em producao/u);
    expect(
      parseEnvironment({
        DATABASE_URL: database,
        AI_SERVICE_URL: 'http://localhost:8000',
        AI_SERVICE_SECRET: 'segredo-local-da-ia',
      }).AI_MAX_ATTEMPTS,
    ).toBe(2);
  });

  it('exige credenciais e URL publica absoluta para S3', () => {
    const base = {
      DATABASE_URL: 'postgresql://user:password@localhost:5432/tanarua',
      STORAGE_PROVIDER: 's3',
    };
    expect(() => parseEnvironment(base)).toThrowError(/STORAGE_BUCKET/u);
    expect(() =>
      parseEnvironment({
        ...base,
        STORAGE_BUCKET: 'bucket-local',
        STORAGE_ACCESS_KEY: 'access-local',
        STORAGE_SECRET_KEY: 'secret-local',
      }),
    ).toThrowError(/STORAGE_PUBLIC_BASE_URL/u);
    expect(
      parseEnvironment({
        ...base,
        STORAGE_BUCKET: 'bucket-local',
        STORAGE_ACCESS_KEY: 'access-local',
        STORAGE_SECRET_KEY: 'secret-local',
        STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.test',
      }).STORAGE_PROVIDER,
    ).toBe('s3');
  });

  it('rejeita porta e URL de banco invalidas sem exibir os valores recebidos', () => {
    expect(() =>
      parseEnvironment({
        PORT: '0',
        DATABASE_URL: 'segredo-invalido',
      }),
    ).toThrowError(/PORT:|DATABASE_URL:/u);
  });
});
