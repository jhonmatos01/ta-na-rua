import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { MediaReader } from './media.types.js';

export class StoredMediaReader implements MediaReader {
  private readonly client =
    env.STORAGE_PROVIDER === 's3'
      ? new S3Client({
          region: env.STORAGE_REGION,
          ...(env.STORAGE_ENDPOINT === undefined
            ? {}
            : { endpoint: env.STORAGE_ENDPOINT, forcePathStyle: true }),
          credentials: {
            accessKeyId: env.STORAGE_ACCESS_KEY!,
            secretAccessKey: env.STORAGE_SECRET_KEY!,
          },
        })
      : null;
  public async read(key: string): Promise<Buffer> {
    try {
      if (this.client !== null) {
        const object = await this.client.send(
          new GetObjectCommand({ Bucket: env.STORAGE_BUCKET!, Key: key }),
        );
        if (object.Body === undefined)
          throw new AppError(404, 'IMAGE_NOT_FOUND', 'Imagem nao encontrada.');
        return Buffer.from(await object.Body.transformToByteArray());
      }
      const directory = path.resolve(env.STORAGE_LOCAL_DIRECTORY);
      const target = path.resolve(directory, key);
      if (!target.startsWith(directory + path.sep))
        throw new AppError(404, 'IMAGE_NOT_FOUND', 'Imagem nao encontrada.');
      return await readFile(target);
    } catch (error) {
      if (
        error instanceof Error &&
        (('code' in error && error.code === 'ENOENT') || error.name === 'NoSuchKey')
      ) {
        throw new AppError(404, 'IMAGE_NOT_FOUND', 'Imagem nao encontrada.');
      }
      throw error;
    }
  }
}
