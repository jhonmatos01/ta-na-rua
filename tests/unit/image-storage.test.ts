import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { AppError } from '../../src/shared/errors/app-error.js';
import { detectImageMime, LocalImageStorage } from '../../src/modules/occurrences/image-storage.js';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const webp = Buffer.from('RIFF0000WEBPdata', 'ascii');

describe('armazenamento de imagens', () => {
  it('detecta JPEG, PNG e WebP pela assinatura binaria', () => {
    expect(detectImageMime(jpeg)).toBe('image/jpeg');
    expect(detectImageMime(png)).toBe('image/png');
    expect(detectImageMime(webp)).toBe('image/webp');
    expect(detectImageMime(Buffer.from('nao-e-imagem'))).toBeNull();
  });

  it('gera chave aleatoria e remove o arquivo local', async () => {
    const storage = new LocalImageStorage(
      path.resolve('tmp', 'test-uploads', randomUUID()),
      '/uploads',
    );
    const stored = await storage.store({
      buffer: png,
      declaredMimeType: 'image/png',
      size: png.length,
    });
    expect(stored.key).toMatch(/^occurrences\/\d{4}\/[0-9a-f-]+\.png$/u);
    expect(stored.url).toBe(`/uploads/${stored.key}`);
    await expect(storage.delete(stored.key)).resolves.toBeUndefined();
    await expect(storage.delete(stored.key)).resolves.toBeUndefined();
  });

  it('rejeita conteudo invalido e divergencia de MIME', async () => {
    const storage = new LocalImageStorage(path.resolve('tmp', 'test-uploads', randomUUID()));
    await expect(
      storage.store({ buffer: png, declaredMimeType: 'image/jpeg', size: png.length }),
    ).rejects.toMatchObject<AppError>({ statusCode: 415, code: 'IMAGE_MIME_MISMATCH' });
    await expect(
      storage.store({
        buffer: Buffer.from('texto'),
        declaredMimeType: 'image/png',
        size: 5,
      }),
    ).rejects.toMatchObject<AppError>({ statusCode: 415, code: 'UNSUPPORTED_IMAGE_TYPE' });
  });
});
