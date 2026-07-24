import { z } from 'zod';

const environmentSchema = z.object({
  VITE_APP_NAME: z.string().trim().min(1).default('Tá na Rua! Gestão'),
  VITE_API_BASE_URL: z.string().trim().min(1).default('/'),
  VITE_API_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  VITE_MAP_STYLE_URL: z.url().default('https://tiles.openfreemap.org/styles/liberty'),
  VITE_MAP_DEFAULT_LATITUDE: z.coerce.number().min(-90).max(90).default(-12.9714),
  VITE_MAP_DEFAULT_LONGITUDE: z.coerce.number().min(-180).max(180).default(-38.5014),
  VITE_MAP_DEFAULT_ZOOM: z.coerce.number().min(1).max(20).default(11),
});

const parsed = environmentSchema.parse(import.meta.env);
const configuredBaseUrl = parsed.VITE_API_BASE_URL.replace(/\/$/u, '');

export const config = Object.freeze({
  appName: parsed.VITE_APP_NAME,
  apiBaseUrl: configuredBaseUrl.startsWith('http')
    ? configuredBaseUrl
    : new URL(configuredBaseUrl || '/', window.location.origin).toString().replace(/\/$/u, ''),
  apiTimeoutMs: parsed.VITE_API_TIMEOUT_MS,
  mapStyleUrl: parsed.VITE_MAP_STYLE_URL,
  defaultMapLatitude: parsed.VITE_MAP_DEFAULT_LATITUDE,
  defaultMapLongitude: parsed.VITE_MAP_DEFAULT_LONGITUDE,
  defaultMapZoom: parsed.VITE_MAP_DEFAULT_ZOOM,
});
