import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { env } from '../../config/env';
import { setAccessToken } from '../../lib/auth-session';
import { server } from '../../tests/server';
import { reverseGeocode } from './geocoding-api';

afterEach(() => setAccessToken(null));

describe('API de geocodificação', () => {
  it('envia coordenadas no corpo autenticado e valida o endereço sanitizado', async () => {
    setAccessToken('access-token');
    let receivedBody: unknown;
    let receivedAuthorization: string | null = null;
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/geocoding/reverse`, async ({ request }) => {
        receivedBody = await request.json();
        receivedAuthorization = request.headers.get('authorization');
        return HttpResponse.json({
          success: true,
          data: {
            address: {
              street: 'Rua das Flores',
              houseNumber: '123',
              streetAddress: 'Rua das Flores, 123',
              neighborhood: 'Pituba',
              city: 'Salvador',
              state: 'Bahia',
              postcode: '41830-000',
              countryCode: 'BR',
              formattedAddress: 'Rua das Flores, 123 · Pituba · Salvador · Bahia',
              provider: {
                name: 'OpenStreetMap',
                text: '© OpenStreetMap contributors',
                url: 'https://www.openstreetmap.org/copyright',
              },
            },
          },
          meta: { requestId: 'geocoding-test' },
        });
      }),
    );

    await expect(
      reverseGeocode({ latitude: -12.7953, longitude: -38.3955 }),
    ).resolves.toMatchObject({ streetAddress: 'Rua das Flores, 123', neighborhood: 'Pituba' });
    expect(receivedBody).toEqual({ latitude: -12.7953, longitude: -38.3955 });
    expect(receivedAuthorization).toBe('Bearer access-token');
  });
});
