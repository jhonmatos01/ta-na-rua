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
  VITE_DEFAULT_MUNICIPALITY_ID: z.uuid(),
  VITE_DEFAULT_MUNICIPALITY_NAME: z.string().trim().min(2).max(150),
  VITE_PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).max(128),
  VITE_MAX_IMAGE_SIZE_MB: z.coerce.number().int().min(1).max(25),
  VITE_MAP_STYLE_URL: z.url(),
  VITE_MAP_DEFAULT_LATITUDE: z.coerce.number().min(-90).max(90),
  VITE_MAP_DEFAULT_LONGITUDE: z.coerce.number().min(-180).max(180),
  VITE_MAP_DEFAULT_ZOOM: z.coerce.number().min(1).max(20),
});

export interface AppEnvironment {
  appName: string;
  appVersion: string;
  apiBaseUrl: string;
  apiTimeoutMs: number;
  enableApiStatus: boolean;
  enableDatabaseStatus: boolean;
  enableDevtools: boolean;
  defaultMunicipalityId: string;
  defaultMunicipalityName: string;
  passwordMinLength: number;
  maxImageSizeMb: number;
  mapStyleUrl: string;
  defaultMapLatitude: number;
  defaultMapLongitude: number;
  defaultMapZoom: number;
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
    defaultMunicipalityId: result.data.VITE_DEFAULT_MUNICIPALITY_ID,
    defaultMunicipalityName: result.data.VITE_DEFAULT_MUNICIPALITY_NAME,
    passwordMinLength: result.data.VITE_PASSWORD_MIN_LENGTH,
    maxImageSizeMb: result.data.VITE_MAX_IMAGE_SIZE_MB,
    mapStyleUrl: result.data.VITE_MAP_STYLE_URL,
    defaultMapLatitude: result.data.VITE_MAP_DEFAULT_LATITUDE,
    defaultMapLongitude: result.data.VITE_MAP_DEFAULT_LONGITUDE,
    defaultMapZoom: result.data.VITE_MAP_DEFAULT_ZOOM,
  };
}

export const env = parseEnvironment(import.meta.env);
