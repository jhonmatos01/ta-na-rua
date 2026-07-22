import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/app-error.js';
import { nominatimReverseResponseSchema } from './geocoding.schemas.js';
import type {
  ReverseGeocodedAddress,
  ReverseGeocodingInput,
  ReverseGeocodingService,
} from './geocoding.types.js';

type FetchImplementation = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;

interface CacheEntry {
  expiresAt: number;
  value: ReverseGeocodedAddress | null;
}

export interface ReverseGeocodingServiceOptions {
  providerUrl?: string | null;
  providerName?: string;
  attributionText?: string;
  attributionUrl?: string;
  userAgent?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  cacheMaximum?: number;
  minimumIntervalMs?: number;
  fetchImplementation?: FetchImplementation;
  now?: () => number;
  sleep?: Sleep;
}

const publicDevelopmentProviderUrl = 'https://nominatim.openstreetmap.org/reverse';

async function defaultSleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function trimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized.slice(0, 500);
}

function firstAddressValue(
  address: Record<string, unknown>,
  names: readonly string[],
): string | null {
  for (const name of names) {
    const value = trimmedString(address[name]);
    if (value !== null) return value;
  }
  return null;
}

function uniqueParts(parts: Array<string | null>): string[] {
  const seen = new Set<string>();
  return parts.filter((part): part is string => {
    if (part === null) return false;
    const key = part.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export class DefaultReverseGeocodingService implements ReverseGeocodingService {
  private readonly providerUrl: string | undefined;
  private readonly providerName: string;
  private readonly attributionText: string;
  private readonly attributionUrl: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly cacheMaximum: number;
  private readonly minimumIntervalMs: number;
  private readonly fetchImplementation: FetchImplementation;
  private readonly now: () => number;
  private readonly sleep: Sleep;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<ReverseGeocodedAddress | null>>();
  private queue: Promise<void> = Promise.resolve();
  private lastProviderRequestAt = 0;

  public constructor(options: ReverseGeocodingServiceOptions = {}) {
    this.providerUrl =
      options.providerUrl === null
        ? undefined
        : (options.providerUrl ??
          env.GEOCODING_PROVIDER_URL ??
          (env.NODE_ENV === 'production' ? undefined : publicDevelopmentProviderUrl));
    this.providerName = options.providerName ?? env.GEOCODING_PROVIDER_NAME;
    this.attributionText = options.attributionText ?? env.GEOCODING_ATTRIBUTION_TEXT;
    this.attributionUrl = options.attributionUrl ?? env.GEOCODING_ATTRIBUTION_URL;
    this.userAgent = options.userAgent ?? env.GEOCODING_USER_AGENT;
    this.timeoutMs = options.timeoutMs ?? env.GEOCODING_TIMEOUT_MS;
    this.cacheTtlMs = options.cacheTtlMs ?? env.GEOCODING_CACHE_TTL_SECONDS * 1_000;
    this.cacheMaximum = options.cacheMaximum ?? env.GEOCODING_CACHE_MAX_ENTRIES;
    this.minimumIntervalMs = options.minimumIntervalMs ?? env.GEOCODING_MIN_INTERVAL_MS;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
  }

  public async reverse(input: ReverseGeocodingInput): Promise<ReverseGeocodedAddress | null> {
    if (this.providerUrl === undefined) {
      throw new AppError(
        503,
        'GEOCODING_NOT_CONFIGURED',
        'A busca de endereco nao esta configurada neste ambiente.',
      );
    }

    const cacheKey = `${input.latitude.toFixed(5)},${input.longitude.toFixed(5)}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined && cached.expiresAt > this.now()) return cached.value;
    if (cached !== undefined) this.cache.delete(cacheKey);

    const active = this.inFlight.get(cacheKey);
    if (active !== undefined) return active;

    const pending = this.enqueue(() => this.fetchAddress(input)).then((value) => {
      this.storeCache(cacheKey, value);
      return value;
    });
    this.inFlight.set(cacheKey, pending);
    try {
      return await pending;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const wait = Math.max(0, this.minimumIntervalMs - (this.now() - this.lastProviderRequestAt));
      if (wait > 0) await this.sleep(wait);
      this.lastProviderRequestAt = this.now();
      return task();
    });
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private storeCache(key: string, value: ReverseGeocodedAddress | null): void {
    const now = this.now();
    if (this.cache.size >= this.cacheMaximum) {
      for (const [cachedKey, entry] of this.cache) {
        if (entry.expiresAt <= now) this.cache.delete(cachedKey);
      }
    }
    if (this.cache.size >= this.cacheMaximum) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { expiresAt: now + this.cacheTtlMs, value });
  }

  private async fetchAddress(input: ReverseGeocodingInput): Promise<ReverseGeocodedAddress | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const providerUrl = this.providerUrl;
      if (providerUrl === undefined) {
        throw new AppError(
          503,
          'GEOCODING_NOT_CONFIGURED',
          'A busca de endereco nao esta configurada neste ambiente.',
        );
      }
      const endpoint = new URL(providerUrl);
      endpoint.searchParams.set('format', 'jsonv2');
      endpoint.searchParams.set('lat', String(input.latitude));
      endpoint.searchParams.set('lon', String(input.longitude));
      endpoint.searchParams.set('zoom', '18');
      endpoint.searchParams.set('addressdetails', '1');
      endpoint.searchParams.set('layer', 'address');
      endpoint.searchParams.set('accept-language', 'pt-BR');

      const response = await this.fetchImplementation(endpoint, {
        method: 'GET',
        headers: { accept: 'application/json', 'user-agent': this.userAgent },
        signal: controller.signal,
      });
      const responseText = await response.text();
      if (responseText.length > 65_536) {
        throw new AppError(
          503,
          'GEOCODING_INVALID_RESPONSE',
          'O servico de endereco retornou uma resposta invalida.',
        );
      }
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new AppError(
          503,
          'GEOCODING_UNAVAILABLE',
          'A busca de endereco esta temporariamente indisponivel.',
        );
      }

      let raw: unknown;
      try {
        raw = JSON.parse(responseText) as unknown;
      } catch {
        throw new AppError(
          503,
          'GEOCODING_INVALID_RESPONSE',
          'O servico de endereco retornou uma resposta invalida.',
        );
      }
      const parsed = nominatimReverseResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new AppError(
          503,
          'GEOCODING_INVALID_RESPONSE',
          'O servico de endereco retornou uma resposta invalida.',
        );
      }
      if (parsed.data.error !== undefined) return null;

      const address = parsed.data.address ?? {};
      const street = firstAddressValue(address, [
        'road',
        'pedestrian',
        'residential',
        'footway',
        'path',
        'cycleway',
      ]);
      const houseNumber = firstAddressValue(address, ['house_number']);
      const streetAddress = uniqueParts([street, houseNumber]).join(', ') || null;
      const neighborhood = firstAddressValue(address, [
        'neighbourhood',
        'suburb',
        'quarter',
        'city_district',
        'borough',
      ]);
      const city = firstAddressValue(address, ['city', 'town', 'village', 'municipality']);
      const state = firstAddressValue(address, ['state']);
      const postcode = firstAddressValue(address, ['postcode']);
      const countryCode = firstAddressValue(address, ['country_code'])?.toUpperCase() ?? null;
      const formattedAddress =
        uniqueParts([streetAddress, neighborhood, city, state]).join(' · ') ||
        trimmedString(parsed.data.display_name);
      if (formattedAddress === null) return null;

      return {
        street,
        houseNumber,
        streetAddress,
        neighborhood,
        city,
        state,
        postcode,
        countryCode,
        formattedAddress,
        provider: {
          name: this.providerName,
          text: this.attributionText,
          url: this.attributionUrl,
        },
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      const timedOut = error instanceof Error && error.name === 'AbortError';
      logger.warn(
        { failure: timedOut ? 'timeout' : 'unavailable' },
        'Falha controlada na geocodificacao reversa.',
      );
      throw new AppError(
        timedOut ? 504 : 503,
        timedOut ? 'GEOCODING_TIMEOUT' : 'GEOCODING_UNAVAILABLE',
        timedOut
          ? 'A busca de endereco excedeu o tempo limite.'
          : 'A busca de endereco esta temporariamente indisponivel.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
