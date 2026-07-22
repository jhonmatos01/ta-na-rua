import { describe, expect, it, vi } from 'vitest';

import type { AppError } from '../../src/shared/errors/app-error.js';
import { DefaultReverseGeocodingService } from '../../src/modules/geocoding/geocoding.service.js';

const providerResponse = {
  display_name: 'Rua das Flores, 123, Pituba, Salvador, Bahia, Brasil',
  address: {
    house_number: '123',
    road: 'Rua das Flores',
    suburb: 'Pituba',
    city: 'Salvador',
    state: 'Bahia',
    postcode: '41830-000',
    country_code: 'br',
  },
};

describe('DefaultReverseGeocodingService', () => {
  it('consulta Nominatim com identificacao, sanitiza o endereco e reutiliza o cache', async () => {
    const fetchImplementation = vi.fn<typeof fetch>((input, init) => {
      expect(input).toBeInstanceOf(URL);
      if (!(input instanceof URL)) throw new Error('URL esperada no teste.');
      expect(input.searchParams.get('lat')).toBe('-12.79531');
      expect(input.searchParams.get('lon')).toBe('-38.39551');
      expect(input.searchParams.get('format')).toBe('jsonv2');
      expect(input.searchParams.get('accept-language')).toBe('pt-BR');
      expect(new Headers(init?.headers).get('user-agent')).toContain('TaNaRua-Test');
      return Promise.resolve(
        new Response(JSON.stringify(providerResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });
    const service = new DefaultReverseGeocodingService({
      providerUrl: 'https://geo.example.test/reverse',
      userAgent: 'TaNaRua-Test/1.0 (+https://example.test)',
      fetchImplementation,
      minimumIntervalMs: 1_000,
      now: () => 5_000,
    });

    const first = await service.reverse({ latitude: -12.79531, longitude: -38.39551 });
    const cached = await service.reverse({ latitude: -12.795311, longitude: -38.395511 });

    expect(first).toMatchObject({
      street: 'Rua das Flores',
      houseNumber: '123',
      streetAddress: 'Rua das Flores, 123',
      neighborhood: 'Pituba',
      city: 'Salvador',
      state: 'Bahia',
      postcode: '41830-000',
      countryCode: 'BR',
      formattedAddress: 'Rua das Flores, 123 · Pituba · Salvador · Bahia',
      provider: { name: 'OpenStreetMap' },
    });
    expect(cached).toEqual(first);
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it('serializa pontos diferentes respeitando o intervalo minimo do provedor', async () => {
    let now = 10_000;
    const sleep = vi.fn((milliseconds: number) => {
      now += milliseconds;
      return Promise.resolve();
    });
    const service = new DefaultReverseGeocodingService({
      providerUrl: 'https://geo.example.test/reverse',
      fetchImplementation: () => Promise.resolve(new Response(JSON.stringify(providerResponse))),
      minimumIntervalMs: 1_000,
      now: () => now,
      sleep,
    });

    await Promise.all([
      service.reverse({ latitude: -12.79, longitude: -38.39 }),
      service.reverse({ latitude: -12.8, longitude: -38.4 }),
    ]);

    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it('retorna ausencia sem inventar rua quando o provedor nao encontra endereco', async () => {
    const service = new DefaultReverseGeocodingService({
      providerUrl: 'https://geo.example.test/reverse',
      fetchImplementation: () =>
        Promise.resolve(new Response(JSON.stringify({ error: 'Unable to geocode' }))),
      minimumIntervalMs: 1_000,
      now: () => 5_000,
    });

    await expect(service.reverse({ latitude: -12.7953, longitude: -38.3955 })).resolves.toBeNull();
  });

  it('transforma timeout e configuracao ausente em erros seguros', async () => {
    const timeoutService = new DefaultReverseGeocodingService({
      providerUrl: 'https://geo.example.test/reverse',
      fetchImplementation: () => Promise.reject(new DOMException('aborted', 'AbortError')),
      minimumIntervalMs: 1_000,
      now: () => 5_000,
    });
    const disabledService = new DefaultReverseGeocodingService({ providerUrl: null });

    await expect(
      timeoutService.reverse({ latitude: -12.7953, longitude: -38.3955 }),
    ).rejects.toMatchObject({ code: 'GEOCODING_TIMEOUT', statusCode: 504 });
    await expect(
      disabledService.reverse({ latitude: -12.7953, longitude: -38.3955 }),
    ).rejects.toEqual(
      expect.objectContaining<AppError>({ code: 'GEOCODING_NOT_CONFIGURED', statusCode: 503 }),
    );
  });
});
