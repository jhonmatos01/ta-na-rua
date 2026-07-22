import { describe, expect, it } from 'vitest';

import { env } from '../../config/env';
import { reportDetailsSchema, reportFieldErrors, reportLocationSchema } from './report-form-schema';

function image(type = 'image/jpeg', size = 1024): File {
  return new File([new Uint8Array(size)], 'problema.jpg', { type });
}

describe('report form schemas', () => {
  it('aceita imagem, texto e localização válidos', () => {
    expect(
      reportDetailsSchema.parse({
        title: 'Buraco na via',
        description: 'Ao lado da faixa.',
        categoryId: '',
        image: image(),
      }),
    ).toMatchObject({ title: 'Buraco na via', description: 'Ao lado da faixa.' });

    expect(
      reportLocationSchema.parse({
        latitude: -12.9714,
        longitude: -38.5014,
        locationAccuracy: 12,
        neighborhoodText: 'Pituba',
        address: '',
      }),
    ).toEqual({
      latitude: -12.9714,
      longitude: -38.5014,
      locationAccuracy: 12,
      neighborhoodText: 'Pituba',
      address: undefined,
    });
  });

  it('rejeita tipo e tamanho de imagem incompatíveis', () => {
    expect(
      reportDetailsSchema.safeParse({ title: 'Buraco', image: image('image/gif') }).success,
    ).toBe(false);
    expect(
      reportDetailsSchema.safeParse({
        title: 'Buraco',
        image: image('image/jpeg', env.maxImageSizeMb * 1024 * 1024 + 1),
      }).success,
    ).toBe(false);
  });

  it('exige título, foto e coordenadas válidas', () => {
    const result = reportDetailsSchema.safeParse({ title: 'a', image: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(reportFieldErrors(result.error)).toMatchObject({
        title: 'Informe um título com pelo menos 3 caracteres.',
        image: 'Adicione uma foto do problema.',
      });
    }
    expect(reportLocationSchema.safeParse({ latitude: 91, longitude: -181 }).success).toBe(false);
  });
});
