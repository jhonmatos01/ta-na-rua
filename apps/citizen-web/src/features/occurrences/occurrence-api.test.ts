import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '../../config/env';
import { server } from '../../tests/server';
import { mapPointFixtures, publicOccurrenceFixture } from '../../tests/occurrence-fixtures';
import { getPublicMapPoints, getPublicOccurrences, resolveApiAssetUrl } from './occurrence-api';

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
});
