import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import { createSuccessResponse } from '../../shared/http/responses.js';
import {
  authorizeRoles,
  createAuthenticate,
  createOptionalAuthenticate,
} from '../../shared/middleware/authorization.js';
import { parseInput } from '../../shared/validation/parse.js';
import {
  PostgresIdentityRepository,
  type IdentityRepository,
} from '../auth/identity.repository.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { PostgresMediaRepository } from './media.repository.js';
import { StoredMediaReader } from './media.reader.js';
import type { MediaRecord, MediaReader, MediaRepository } from './media.types.js';

const statuses = ['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED'] as const;
const idSchema = z.strictObject({ imageId: z.uuid() });
const listSchema = z.strictObject({
  status: z.enum(statuses).default('PENDING'),
  municipalityId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const decisionSchema = z.strictObject({
  status: z.enum(['APPROVED', 'REJECTED', 'FLAGGED']),
  expectedStatus: z.enum(statuses),
  reason: z.string().trim().min(3).max(1000),
  sanitizationMode: z.enum(['CLEAR', 'BLUR']).optional(),
});
export interface MediaRouterOptions {
  repository?: MediaRepository;
  reader?: MediaReader;
  identityRepository?: IdentityRepository;
}
export function canReadOriginal(image: MediaRecord, principal?: AuthenticatedPrincipal): boolean {
  return (
    principal?.role === 'ADMIN' ||
    principal?.role === 'MODERATOR' ||
    principal?.sub === image.ownerId ||
    (principal?.role === 'CITY_OPERATOR' && principal.municipalityId === image.municipalityId)
  );
}
export function canReadMedia(image: MediaRecord, principal?: AuthenticatedPrincipal): boolean {
  return (
    canReadOriginal(image, principal) ||
    (!!image.publicStorageKey &&
      image.moderationStatus === 'APPROVED' &&
      !['PENDING_REVIEW', 'REJECTED'].includes(image.occurrenceStatus))
  );
}
async function readVisible(
  image: MediaRecord,
  principal: AuthenticatedPrincipal | undefined,
  reader: MediaReader,
): Promise<{ bytes: Buffer; mime: string }> {
  if (image.moderationStatus === 'APPROVED' && image.publicStorageKey)
    return { bytes: await reader.read(image.publicStorageKey), mime: 'image/webp' };
  if (!canReadOriginal(image, principal))
    throw new AppError(404, 'IMAGE_NOT_FOUND', 'Imagem nao encontrada.');
  return { bytes: await reader.read(image.storageKey), mime: image.mimeType };
}
export function createMediaRouter(options: MediaRouterOptions = {}): Router {
  const repository = options.repository ?? new PostgresMediaRepository();
  const reader = options.reader ?? new StoredMediaReader();
  const identity = options.identityRepository ?? new PostgresIdentityRepository();
  const router = Router();
  router.get(
    '/api/v1/media/:imageId',
    createOptionalAuthenticate(identity),
    async (request, response, next) => {
      try {
        response.set('Cache-Control', 'private, no-store').set('Vary', 'Authorization');
        const { imageId } = parseInput(idSchema, request.params);
        const image = await repository.find({ id: imageId });
        if (image === null || !canReadMedia(image, request.auth))
          throw new AppError(404, 'IMAGE_NOT_FOUND', 'Imagem nao encontrada.');
        const media = await readVisible(image, request.auth, reader);
        response.type(media.mime).send(media.bytes);
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/api/v1/media/:imageId/original',
    createAuthenticate(identity),
    async (request, response, next) => {
      try {
        response.set('Cache-Control', 'private, no-store').set('Vary', 'Authorization');
        const { imageId } = parseInput(idSchema, request.params);
        const image = await repository.find({ id: imageId });
        if (!image || !canReadOriginal(image, request.auth))
          throw new AppError(404, 'IMAGE_NOT_FOUND', 'Imagem nao encontrada.');
        response.type(image.mimeType).send(await reader.read(image.storageKey));
      } catch (error) {
        next(error);
      }
    },
  );
  // Old local URLs receive the same authorization checks; no directory is served statically.
  router.get(
    '/uploads/*key',
    createOptionalAuthenticate(identity),
    async (request, response, next) => {
      try {
        response.set('Cache-Control', 'private, no-store').set('Vary', 'Authorization');
        const parts = request.params.key;
        const key = Array.isArray(parts) ? parts.join('/') : parts;
        if (
          typeof key !== 'string' ||
          key.split('/').some((part) => ['.', '..', ''].includes(part)) ||
          key.includes('\\')
        ) {
          throw new AppError(404, 'IMAGE_NOT_FOUND', 'Imagem nao encontrada.');
        }
        const image = await repository.find({ storageKey: key });
        if (image === null || !canReadMedia(image, request.auth))
          throw new AppError(404, 'IMAGE_NOT_FOUND', 'Imagem nao encontrada.');
        const media = await readVisible(image, request.auth, reader);
        response.type(media.mime).send(media.bytes);
      } catch (error) {
        next(error);
      }
    },
  );
  const protectedRouter = Router();
  protectedRouter.use(createAuthenticate(identity), authorizeRoles('ADMIN', 'MODERATOR'));
  protectedRouter.get('/', async (request, response, next) => {
    try {
      response.set('Cache-Control', 'private, no-store');
      const query = parseInput(listSchema, request.query);
      const result = await repository.list(query);
      response.json(
        createSuccessResponse(request, {
          images: result.images.map((image) => ({
            id: image.id,
            occurrenceId: image.occurrenceId,
            title: image.title,
            protocol: image.protocol,
            municipalityId: image.municipalityId,
            status: image.moderationStatus,
            occurrenceStatus: image.occurrenceStatus,
            createdAt: image.createdAt,
            sanitizationMode: image.sanitizationMode ?? null,
            originalUrl: `/api/v1/media/${image.id}/original`,
            url: `/api/v1/media/${image.id}`,
          })),
          pagination: {
            page: query.page,
            limit: query.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / query.limit),
          },
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  protectedRouter.patch('/:imageId', async (request, response, next) => {
    try {
      const { imageId } = parseInput(idSchema, request.params);
      const decision = parseInput(decisionSchema, request.body);
      const image = await repository.review(imageId, decision, request.auth!.sub, {
        ipAddress: request.ip ?? null,
        userAgent: request.get('user-agent') ?? null,
      });
      if (image === null) throw new AppError(404, 'IMAGE_NOT_FOUND', 'Imagem nao encontrada.');
      response.set('Cache-Control', 'private, no-store').json(
        createSuccessResponse(request, {
          image: { id: image.id, status: image.moderationStatus },
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  router.use('/api/v1/moderation/images', protectedRouter);
  return router;
}
