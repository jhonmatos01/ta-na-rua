import { z } from 'zod';

const environmentSchema = z.object({
  VITE_APP_NAME: z.string().trim().min(1).default('Tá na Rua! Gestão'),
  VITE_API_BASE_URL: z.string().trim().min(1).default('/'),
  VITE_API_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
});

const parsed = environmentSchema.parse(import.meta.env);
const configuredBaseUrl = parsed.VITE_API_BASE_URL.replace(/\/$/u, '');

export const config = Object.freeze({
  appName: parsed.VITE_APP_NAME,
  apiBaseUrl: configuredBaseUrl.startsWith('http')
    ? configuredBaseUrl
    : new URL(configuredBaseUrl || '/', window.location.origin).toString().replace(/\/$/u, ''),
  apiTimeoutMs: parsed.VITE_API_TIMEOUT_MS,
});
