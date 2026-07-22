import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { env } from '../../config/env';
import { server } from '../../tests/server';
import {
  createdOccurrenceFixture,
  mapPointFixtures,
  publicOccurrenceFixture,
} from '../../tests/occurrence-fixtures';
import { setAccessToken } from '../../lib/auth-session';
import {
  createOccurrence,
  getNearbyOccurrences,
  getPublicMapPoints,
  getPublicOccurrences,
  resolveApiAssetUrl,
} from './occurrence-api';

afterEach(() => setAccessToken(null));

describe('API pública de ocorrências', () => {
  it('envia filtros suportados sem incluir busca textual na API', async () => {
    let receivedUrl: URL | undefined;
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/occurrences`, ({ request }) => {
        receivedUrl = new URL(request.url);
        return HttpResponse.json({
          success: true,
          data: { occurrences: [publicOccurrenceFixture] },
          meta: {
            requestId: 'filtered-list',
            page: 1,
            limit: 100,
            total: 1,
            totalPages: 1,
          },
        });
      }),
    );

    await getPublicOccurrences({
      category: publicOccurrenceFixture.category!.id,
      neighborhood: 'Pituba',
      status: 'IN_PROGRESS',
    });

    expect(receivedUrl?.searchParams.get('municipalityId')).toBe(env.defaultMunicipalityId);
    expect(receivedUrl?.searchParams.get('category')).toBe(publicOccurrenceFixture.category!.id);
    expect(receivedUrl?.searchParams.get('neighborhood')).toBe('Pituba');
    expect(receivedUrl?.searchParams.get('status')).toBe('IN_PROGRESS');
    expect(receivedUrl?.searchParams.has('search')).toBe(false);
  });

  it('valida a resposta leve usada pelos marcadores', async () => {
    await expect(getPublicMapPoints({})).resolves.toEqual(mapPointFixtures);
  });

  it('resolve somente URLs HTTP seguras para imagens públicas', () => {
    expect(resolveApiAssetUrl('/uploads/teste.jpg')).toBe(`${env.apiBaseUrl}/uploads/teste.jpg`);
    expect(resolveApiAssetUrl('javascript:alert(1)')).toBeNull();
  });

  it('consulta candidatos próximos com o contrato geográfico oficial', async () => {
    let receivedUrl: URL | undefined;
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/occurrences/nearby`, ({ request }) => {
        receivedUrl = new URL(request.url);
        return HttpResponse.json({
          success: true,
          data: { occurrences: [publicOccurrenceFixture] },
          meta: { requestId: 'nearby', page: 1, limit: 5, total: 1, totalPages: 1 },
        });
      }),
    );

    await expect(
      getNearbyOccurrences({ latitude: -12.9714, longitude: -38.5014 }),
    ).resolves.toHaveLength(1);
    expect(receivedUrl?.searchParams.has('radius')).toBe(false);
    expect(receivedUrl?.searchParams.get('municipalityId')).toBe(env.defaultMunicipalityId);
  });

  it('envia imagem e campos em multipart autenticado sem fixar Content-Type', async () => {
    setAccessToken('access-token');
    let receivedAuthorization: string | null = null;
    let receivedContentType: string | null = null;
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/occurrences`, ({ request }) => {
        receivedAuthorization = request.headers.get('authorization');
        receivedContentType = request.headers.get('content-type');
        return HttpResponse.json(
          {
            success: true,
            data: { occurrence: createdOccurrenceFixture },
            meta: { requestId: 'created' },
          },
          { status: 201 },
        );
      }),
    );

    const result = await createOccurrence({
      title: 'Buraco na via',
      description: 'Próximo à faixa',
      image: new File(['imagem'], 'buraco.jpg', { type: 'image/jpeg' }),
      latitude: -12.9714,
      longitude: -38.5014,
      locationAccuracy: 12,
      neighborhoodText: 'Pituba',
      anonymousPublication: false,
    });

    expect(result.protocol).toBe('TNR-2026-000099');
    expect(receivedAuthorization).toBe('Bearer access-token');
    expect(receivedContentType).toContain('multipart/form-data; boundary=');
  });
});
