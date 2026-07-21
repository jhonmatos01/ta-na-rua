import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const environmentSchema = z.object({
  VITE_APP_NAME: z.string().trim().min(1),
  VITE_APP_VERSION: z.string().trim().min(1),
  VITE_API_BASE_URL: z.url(),
  VITE_API_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000),
  VITE_ENABLE_API_STATUS: booleanString,
  VITE_ENABLE_DATABASE_STATUS: booleanString,
  VITE_ENABLE_DEVTOOLS: booleanString,
});

export interface AppEnvironment {
  appName: string;
  appVersion: string;
  apiBaseUrl: string;
  apiTimeoutMs: number;
  enableApiStatus: boolean;
  enableDatabaseStatus: boolean;
  enableDevtools: boolean;
}

export function parseEnvironment(source: Record<string, unknown>): AppEnvironment {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const invalidKeys = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(
      ', ',
    );
    throw new Error(`Configuração pública inválida. Revise: ${invalidKeys}.`);
  }

  return {
    appName: result.data.VITE_APP_NAME,
    appVersion: result.data.VITE_APP_VERSION,
    apiBaseUrl: result.data.VITE_API_BASE_URL.replace(/\/$/, ''),
    apiTimeoutMs: result.data.VITE_API_TIMEOUT_MS,
    enableApiStatus: result.data.VITE_ENABLE_API_STATUS,
    enableDatabaseStatus: result.data.VITE_ENABLE_DATABASE_STATUS,
    enableDevtools: result.data.VITE_ENABLE_DEVTOOLS,
  };
}

export const env = parseEnvironment(import.meta.env);
