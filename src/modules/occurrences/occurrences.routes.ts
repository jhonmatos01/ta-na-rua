import type { Request, RequestHandler } from 'express';
import { Router } from 'express';
import multer from 'multer';

import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createSuccessResponse } from '../../shared/http/responses.js';
import {
  authorizeRoles,
  createAuthenticate,
  createOptionalAuthenticate,
} from '../../shared/middleware/authorization.js';
import { parseInput } from '../../shared/validation/parse.js';
import type { RequestContext } from '../auth/auth.types.js';
import {
  PostgresIdentityRepository,
  type IdentityRepository,
} from '../auth/identity.repository.js';
import { DefaultAiAnalysisService } from '../ai/ai.service.js';
import type { OccurrenceAiProcessor } from '../ai/ai.types.js';
import { createImageStorage, type ImageStorage } from './image-storage.js';
import { PostgresOccurrenceRepository } from './occurrences.repository.js';
import {
  createOccurrenceSchema,
  mapQuerySchema,
  nearbyQuerySchema,
  occurrenceIdParamsSchema,
  occurrenceListQuerySchema,
  updateOccurrenceSchema,
} from './occurrences.schemas.js';
import { DefaultOccurrencesService, type OccurrencesService } from './occurrences.service.js';
import type { PaginatedOccurrences } from './occurrences.service.js';
import type { OccurrenceRepository, UploadedFile } from './occurrences.types.js';

function requestContext(request: Request): RequestContext {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  };
}

function requiredFile(request: Request): UploadedFile {
  if (request.file === undefined) {
    throw new AppError(422, 'IMAGE_REQUIRED', 'Envie uma imagem no campo image.');
  }
  return {
    buffer: request.file.buffer,
    declaredMimeType: request.file.mimetype.toLowerCase(),
    size: request.file.size,
  };
}

function paginatedResponse(request: Request, result: PaginatedOccurrences) {
  return {
    success: true as const,
    data: { occurrences: result.occurrences },
    meta: { requestId: request.requestId, ...result.pagination },
  };
}

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_IMAGE_SIZE_MB * 1024 * 1024, files: 1, fields: 20 },
});

const uploadImage: RequestHandler = (request, response, next) => {
  multerUpload.single('image')(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(
        new AppError(
          413,
          'IMAGE_TOO_LARGE',
          `A imagem deve possuir no maximo ${env.MAX_IMAGE_SIZE_MB} MB.`,
        ),
      );
      return;
    }
    if (error !== undefined) {
      next(new AppError(400, 'INVALID_MULTIPART', 'O upload multipart e invalido.'));
      return;
    }
    next();
  });
};

export interface OccurrencesRouterOptions {
  identityRepository?: IdentityRepository;
  occurrenceRepository?: OccurrenceRepository;
  storage?: ImageStorage;
  aiProcessor?: OccurrenceAiProcessor;
  service?: OccurrencesService;
}

export function createOccurrencesRouter(options: OccurrencesRouterOptions = {}): Router {
  const identityRepository = options.identityRepository ?? new PostgresIdentityRepository();
  const occurrenceRepository = options.occurrenceRepository ?? new PostgresOccurrenceRepository();
  const storage = options.storage ?? createImageStorage();
  const aiProcessor = options.aiProcessor ?? new DefaultAiAnalysisService();
  const service =
    options.service ?? new DefaultOccurrencesService(occurrenceRepository, storage, aiProcessor);
  const authenticate = createAuthenticate(identityRepository);
  const optionalAuthenticate = createOptionalAuthenticate(identityRepository);
  const router = Router();

  router.get('/', optionalAuthenticate, async (request, response, next) => {
    try {
      const result = await service.list(
        request.auth,
        parseInput(occurrenceListQuerySchema, request.query),
      );
      response.status(200).json(paginatedResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.post('/', authenticate, uploadImage, async (request, response, next) => {
    try {
      const occurrence = await service.create(
        request.auth!,
        parseInput(createOccurrenceSchema, request.body),
        requiredFile(request),
        requestContext(request),
      );
      response.status(201).json(createSuccessResponse(request, { occurrence }));
    } catch (error) {
      next(error);
    }
  });

  router.get('/nearby', optionalAuthenticate, async (request, response, next) => {
    try {
      const result = await service.nearby(
        request.auth,
        parseInput(nearbyQuerySchema, request.query),
      );
      response.status(200).json(paginatedResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get('/map', optionalAuthenticate, async (request, response, next) => {
    try {
      const result = await service.map(request.auth, parseInput(mapQuerySchema, request.query));
      response.status(200).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get('/mine', authenticate, async (request, response, next) => {
    try {
      const result = await service.mine(
        request.auth!,
        parseInput(occurrenceListQuerySchema, request.query),
      );
      response.status(200).json(paginatedResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get('/confirmed-by-me', authenticate, async (request, response, next) => {
    try {
      const result = await service.confirmedByMe(
        request.auth!,
        parseInput(occurrenceListQuerySchema, request.query),
      );
      response.status(200).json(paginatedResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.get('/:occurrenceId', optionalAuthenticate, async (request, response, next) => {
    try {
      const { occurrenceId } = parseInput(occurrenceIdParamsSchema, request.params);
      const occurrence = await service.get(request.auth, occurrenceId);
      response.status(200).json(createSuccessResponse(request, { occurrence }));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:occurrenceId', authenticate, async (request, response, next) => {
    try {
      const { occurrenceId } = parseInput(occurrenceIdParamsSchema, request.params);
      const occurrence = await service.update(
        request.auth!,
        occurrenceId,
        parseInput(updateOccurrenceSchema, request.body),
        requestContext(request),
      );
      response.status(200).json(createSuccessResponse(request, { occurrence }));
    } catch (error) {
      next(error);
    }
  });

  router.delete(
    '/:occurrenceId',
    authenticate,
    authorizeRoles('MODERATOR', 'ADMIN'),
    async (request, response, next) => {
      try {
        const { occurrenceId } = parseInput(occurrenceIdParamsSchema, request.params);
        await service.delete(request.auth!, occurrenceId, requestContext(request));
        response.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/:occurrenceId/images',
    authenticate,
    uploadImage,
    async (request, response, next) => {
      try {
        const { occurrenceId } = parseInput(occurrenceIdParamsSchema, request.params);
        const image = await service.addImage(
          request.auth!,
          occurrenceId,
          requiredFile(request),
          requestContext(request),
        );
        response.status(201).json(createSuccessResponse(request, { image }));
      } catch (error) {
        next(error);
      }
    },
  );

  router.get('/:occurrenceId/timeline', optionalAuthenticate, async (request, response, next) => {
    try {
      const { occurrenceId } = parseInput(occurrenceIdParamsSchema, request.params);
      const timeline = await service.timeline(request.auth, occurrenceId);
      response.status(200).json(createSuccessResponse(request, timeline));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
