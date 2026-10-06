import sharp from 'sharp';
import { AppError } from '../../shared/errors/app-error.js';
import { createImageStorage, type ImageStorage } from '../occurrences/image-storage.js';
import { StoredMediaReader } from './media.reader.js';
import type { MediaReader } from './media.types.js';

export type SanitizationMode = 'CLEAR' | 'BLUR';
export async function sanitizeImage(buffer: Buffer, mode: SanitizationMode): Promise<Buffer> {
  try {
    const image = sharp(buffer, {
      limitInputPixels: 40_000_000,
      failOn: 'warning',
      animated: false,
    });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1)
      throw new Error('Unsupported image');
    const normalized = await image
      .rotate()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .png()
      .toBuffer();
    if (mode === 'CLEAR') return await sharp(normalized).webp({ quality: 85 }).toBuffer();
    const dimensions = await sharp(normalized).metadata();
    const reduced = await sharp(normalized)
      .resize({ width: 12, height: 12, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return await sharp(reduced)
      .resize(dimensions.width, dimensions.height, { kernel: 'nearest' })
      .blur(20)
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new AppError(
      422,
      'IMAGE_SANITIZATION_FAILED',
      'Nao foi possivel preparar esta imagem. Envie um arquivo JPEG, PNG ou WebP valido, sem animacao e com ate 40 megapixels.',
    );
  }
}
export class MediaSanitizer {
  public constructor(
    private readonly reader: MediaReader = new StoredMediaReader(),
    private readonly storage: ImageStorage = createImageStorage(),
  ) {}
  public async prepare(key: string, mode: SanitizationMode): Promise<string> {
    const buffer = await sanitizeImage(await this.reader.read(key), mode);
    const image = await this.storage.store({
      buffer,
      size: buffer.length,
      declaredMimeType: 'image/webp',
    });
    return image.key;
  }
  public async discard(key: string): Promise<void> {
    await this.storage.delete(key);
  }
}
