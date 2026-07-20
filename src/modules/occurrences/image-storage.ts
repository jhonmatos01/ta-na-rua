import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { StoredImage, UploadedFile } from './occurrences.types.js';

const mimeExtensions = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

type SupportedMime = keyof typeof mimeExtensions;

export interface ImageStorage {
  store(file: UploadedFile): Promise<StoredImage>;
  delete(key: string): Promise<void>;
}

export function detectImageMime(buffer: Buffer): SupportedMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function prepareImage(file: UploadedFile): { key: string; mimeType: SupportedMime } {
  const mimeType = detectImageMime(file.buffer);
  if (mimeType === null) {
    throw new AppError(
      415,
      'UNSUPPORTED_IMAGE_TYPE',
      'A imagem deve possuir conteudo JPEG, PNG ou WebP valido.',
    );
  }
  if (file.declaredMimeType !== mimeType) {
    throw new AppError(
      415,
      'IMAGE_MIME_MISMATCH',
      'O tipo declarado nao corresponde ao conteudo real da imagem.',
    );
  }
  return {
    key: `occurrences/${new Date().getUTCFullYear()}/${randomUUID()}.${mimeExtensions[mimeType]}`,
    mimeType,
  };
}

export class LocalImageStorage implements ImageStorage {
  public constructor(
    private readonly directory = path.resolve(env.STORAGE_LOCAL_DIRECTORY),
    private readonly publicBaseUrl = env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/u, ''),
  ) {}

  public async store(file: UploadedFile): Promise<StoredImage> {
    const prepared = prepareImage(file);
    const target = path.resolve(this.directory, ...prepared.key.split('/'));
    if (!target.startsWith(`${this.directory}${path.sep}`)) {
      throw new AppError(500, 'INVALID_STORAGE_KEY', 'A chave de armazenamento e invalida.');
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.buffer, { flag: 'wx' });
    return {
      key: prepared.key,
      url: `${this.publicBaseUrl}/${prepared.key}`,
      mimeType: prepared.mimeType,
      size: file.size,
    };
  }

  public async delete(key: string): Promise<void> {
    const target = path.resolve(this.directory, ...key.split('/'));
    if (!target.startsWith(`${this.directory}${path.sep}`)) return;
    try {
      await unlink(target);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
}

export class S3ImageStorage implements ImageStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  public constructor() {
    this.bucket = env.STORAGE_BUCKET!;
    this.publicBaseUrl = env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/u, '');
    this.client = new S3Client({
      region: env.STORAGE_REGION,
      ...(env.STORAGE_ENDPOINT === undefined
        ? {}
        : { endpoint: env.STORAGE_ENDPOINT, forcePathStyle: true }),
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY!,
        secretAccessKey: env.STORAGE_SECRET_KEY!,
      },
    });
  }

  public async store(file: UploadedFile): Promise<StoredImage> {
    const prepared = prepareImage(file);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: prepared.key,
        Body: file.buffer,
        ContentType: prepared.mimeType,
      }),
    );
    return {
      key: prepared.key,
      url: `${this.publicBaseUrl}/${prepared.key}`,
      mimeType: prepared.mimeType,
      size: file.size,
    };
  }

  public async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

export function createImageStorage(): ImageStorage {
  return env.STORAGE_PROVIDER === 's3' ? new S3ImageStorage() : new LocalImageStorage();
}
