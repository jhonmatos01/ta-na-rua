import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { sanitizeImage } from '../../src/modules/media/media.sanitizer.js';

describe('sanitizacao de imagem publica', () => {
  it('remove EXIF e outros metadados e entrega WebP com dimensoes limitadas', async () => {
    const original = await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: 'red' },
    })
      .withExif({ IFD0: { Artist: 'Nome privado', ImageDescription: 'Local privado' } })
      .jpeg()
      .toBuffer();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const sanitized = await sanitizeImage(original, 'CLEAR');
    const metadata = await sharp(sanitized).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(2048);
    expect(metadata.height).toBe(1024);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(sanitized.equals(original)).toBe(false);
  });
  it('desfoque integral reduz detalhes sem alterar dimensoes', async () => {
    const pixels = Buffer.alloc(128 * 128 * 3);
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const value = (x + y) % 2 ? 255 : 0;
        pixels.fill(value, (y * 128 + x) * 3, (y * 128 + x) * 3 + 3);
      }
    const original = await sharp(pixels, { raw: { width: 128, height: 128, channels: 3 } })
      .png()
      .toBuffer();
    const output = await sanitizeImage(original, 'BLUR');
    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBe(128);
    expect(metadata.height).toBe(128);
    expect((await sharp(output).stats()).channels[0]!.stdev).toBeLessThan(20);
    expect((await sharp(original).stats()).channels[0]!.stdev).toBeGreaterThan(100);
  });
  it('recusa arquivo corrompido sem produzir copia publica', async () => {
    await expect(sanitizeImage(Buffer.from('invalid'), 'CLEAR')).rejects.toMatchObject({
      statusCode: 422,
      code: 'IMAGE_SANITIZATION_FAILED',
    });
  });
});
