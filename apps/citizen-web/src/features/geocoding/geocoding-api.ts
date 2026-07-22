import { z } from 'zod';

import { ApiError, getSafeErrorMessage } from '../../lib/api-error';
import { apiRequest } from '../../lib/http-client';

const providerSchema = z.object({
  name: z.string().min(1),
  text: z.string().min(1),
  url: z.url(),
});

export const reverseGeocodedAddressSchema = z.object({
  street: z.string().nullable(),
  houseNumber: z.string().nullable(),
  streetAddress: z.string().nullable(),
  neighborhood: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postcode: z.string().nullable(),
  countryCode: z.string().nullable(),
  formattedAddress: z.string().min(1),
  provider: providerSchema,
});

const reverseGeocodingResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ address: reverseGeocodedAddressSchema.nullable() }),
  meta: z.object({ requestId: z.string().min(1) }),
});

export type ReverseGeocodedAddress = z.infer<typeof reverseGeocodedAddressSchema>;

export async function reverseGeocode(location: { latitude: number; longitude: number }) {
  const response = await apiRequest('/api/v1/geocoding/reverse', {
    method: 'POST',
    body: location,
    schema: reverseGeocodingResponseSchema,
    auth: true,
  });
  return response.data.address;
}

const geocodingMessages: Record<string, string> = {
  GEOCODING_NOT_CONFIGURED: 'A busca automática de endereço não está configurada neste ambiente.',
  GEOCODING_RATE_LIMITED: 'Aguarde um momento antes de buscar outro endereço.',
  GEOCODING_TIMEOUT: 'A busca do endereço demorou demais. Tente novamente.',
  GEOCODING_UNAVAILABLE: 'A busca automática de endereço está temporariamente indisponível.',
  GEOCODING_INVALID_RESPONSE:
    'O serviço de endereço respondeu de forma inesperada. Informe o local manualmente.',
};

export function getReverseGeocodingErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.apiCode) {
    const message = geocodingMessages[error.apiCode];
    if (message !== undefined) return message;
  }
  return getSafeErrorMessage(error);
}
