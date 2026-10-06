import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthenticatedPrincipal, RequestContext } from '../auth/auth.types.js';
import type { OccurrenceAiProcessor } from '../ai/ai.types.js';
import type { ImageStorage } from './image-storage.js';
import type {
  CreateOccurrenceInput,
  MapQuery,
  NearbyQuery,
  OccurrenceListQuery,
  UpdateOccurrenceInput,
} from './occurrences.schemas.js';
import {
  OccurrenceImageLimitError,
  type OccurrenceRecord,
  type OccurrenceRepository,
  type OccurrenceVisibility,
  type RequestPrincipal,
  type UploadedFile,
} from './occurrences.types.js';

function sanitizeAddress(address: string | null): string | null {
  if (address === null) return null;
  const street = address.split(',')[0] ?? address;
  const sanitized = street
    .replace(/\b(?:n(?:º|°|o)?\.?\s*)?\d+[a-z-]*\b/giu, '')
    .replace(/\s{2,}/gu, ' ')
    .replace(/[\s,;-]+$/gu, '')
    .trim();
  return sanitized.length === 0 ? null : sanitized;
}

function roundPublicCoordinate(value: number): number {
  return Number(value.toFixed(4));
}

function baseOccurrence(record: OccurrenceRecord) {
  return {
    id: record.id,
    protocol: record.protocol,
    title: record.title,
    description: record.description,
    category:
      record.categoryId === null ? null : { id: record.categoryId, name: record.categoryName },
    municipality: { id: record.municipalityId, name: record.municipalityName },
    neighborhood:
      record.neighborhoodId === null
        ? record.neighborhoodText
        : { id: record.neighborhoodId, name: record.neighborhoodName },
    status: record.status,
    severity: record.severity,
    priorityScore: record.priorityScore,
    riskLevel: record.riskLevel,
    confirmationCount: record.confirmationCount,
    anonymousPublication: record.anonymousPublication,
    images: record.images.map((image) => ({
      id: image.id,
      url: `/api/v1/media/${image.id}`,
      mimeType: image.mimeType,
      imageType: image.imageType,
      moderationStatus: image.moderationStatus,
      createdAt: image.createdAt,
    })),
    firstReportedAt: record.firstReportedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.distanceMeters === undefined ? {} : { distanceMeters: record.distanceMeters }),
  };
}

function serializePublic(record: OccurrenceRecord) {
  return {
    ...baseOccurrence({
      ...record,
      images: record.images.filter((image) => image.moderationStatus === 'APPROVED'),
    }),
    address: sanitizeAddress(record.address),
    location: {
      latitude: roundPublicCoordinate(record.latitude),
      longitude: roundPublicCoordinate(record.longitude),
      approximate: true,
    },
  };
}

function serializeDetailed(record: OccurrenceRecord) {
  return {
    ...baseOccurrence(record),
    createdBy: record.createdBy,
    address: record.address,
    location: {
      latitude: record.latitude,
      longitude: record.longitude,
      accuracy: record.locationAccuracy,
      approximate: false,
    },
  };
}

function canSeeDetailed(record: OccurrenceRecord, principal?: RequestPrincipal): boolean {
  if (principal === undefined) return false;
  if (principal.role === 'ADMIN' || principal.role === 'MODERATOR') return true;
  if (principal.sub === record.createdBy) return true;
  return principal.role === 'CITY_OPERATOR' && principal.municipalityId === record.municipalityId;
}

function canSeeRecord(record: OccurrenceRecord, principal?: RequestPrincipal): boolean {
  if (!['PENDING_REVIEW', 'REJECTED'].includes(record.status)) return true;
  return canSeeDetailed(record, principal);
}

function visibilityForList(
  principal: RequestPrincipal | undefined,
  requestedMunicipalityId?: string,
): OccurrenceVisibility {
  if (principal?.role === 'ADMIN' || principal?.role === 'MODERATOR') {
    return { publicOnly: false };
  }
  if (principal?.role === 'CITY_OPERATOR') {
    if (
      requestedMunicipalityId !== undefined &&
      requestedMunicipalityId !== principal.municipalityId
    ) {
      throw new AppError(403, 'MUNICIPALITY_FORBIDDEN', 'Acesso negado para este municipio.');
    }
    if (principal.municipalityId === null) {
      throw new AppError(403, 'MUNICIPALITY_REQUIRED', 'O operador nao possui municipio.');
    }
    return { publicOnly: false, municipalityId: principal.municipalityId };
  }
  return { publicOnly: true };
}

export interface OccurrencesService {
  create(
    principal: AuthenticatedPrincipal,
    input: CreateOccurrenceInput,
    file: UploadedFile,
    context: RequestContext,
  ): Promise<unknown>;
  list(
    principal: AuthenticatedPrincipal | undefined,
    query: OccurrenceListQuery,
  ): Promise<PaginatedOccurrences>;
  nearby(
    principal: AuthenticatedPrincipal | undefined,
    query: NearbyQuery,
  ): Promise<PaginatedOccurrences>;
  map(principal: AuthenticatedPrincipal | undefined, query: MapQuery): Promise<unknown>;
  mine(
    principal: AuthenticatedPrincipal,
    query: OccurrenceListQuery,
  ): Promise<PaginatedOccurrences>;
  get(principal: AuthenticatedPrincipal | undefined, occurrenceId: string): Promise<unknown>;
  update(
    principal: AuthenticatedPrincipal,
    occurrenceId: string,
    input: UpdateOccurrenceInput,
    context: RequestContext,
  ): Promise<unknown>;
  delete(
    principal: AuthenticatedPrincipal,
    occurrenceId: string,
    context: RequestContext,
  ): Promise<void>;
  addImage(
    principal: AuthenticatedPrincipal,
    occurrenceId: string,
    file: UploadedFile,
    context: RequestContext,
  ): Promise<unknown>;
  timeline(principal: AuthenticatedPrincipal | undefined, occurrenceId: string): Promise<unknown>;
}

export interface PaginatedOccurrences {
  occurrences: unknown[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export class DefaultOccurrencesService implements OccurrencesService {
  public constructor(
    private readonly repository: OccurrenceRepository,
    private readonly storage: ImageStorage,
    private readonly aiProcessor?: OccurrenceAiProcessor,
  ) {}

  public async create(
    principal: AuthenticatedPrincipal,
    input: CreateOccurrenceInput,
    file: UploadedFile,
    context: RequestContext,
  ): Promise<unknown> {
    const validation = await this.repository.validateLocationAndReferences(input);
    if (!validation.municipalityExists) {
      throw new AppError(422, 'INVALID_MUNICIPALITY', 'O municipio informado nao esta ativo.');
    }
    if (
      !validation.declaredMunicipalityIsNearest ||
      validation.distanceMeters === null ||
      validation.distanceMeters > env.MUNICIPALITY_MAX_DISTANCE_METERS
    ) {
      throw new AppError(
        422,
        'LOCATION_OUTSIDE_MUNICIPALITY',
        'As coordenadas nao sao compativeis com o municipio informado.',
      );
    }
    if (!validation.neighborhoodMatches) {
      throw new AppError(
        422,
        'INVALID_NEIGHBORHOOD',
        'O bairro nao pertence ao municipio informado.',
      );
    }
    if (!validation.categoryExists) {
      throw new AppError(422, 'INVALID_CATEGORY', 'A categoria informada nao esta ativa.');
    }

    const duplicateWindowStart = new Date(
      Date.now() - env.DUPLICATE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );
    const nearbyCandidates = await this.repository.list(
      {
        municipalityId: input.municipalityId,
        latitude: input.latitude,
        longitude: input.longitude,
        radius: env.DUPLICATE_RADIUS_METERS,
        startDate: duplicateWindowStart,
        page: 1,
        limit: Math.min(5, env.MAX_PAGE_SIZE),
      },
      { publicOnly: false, municipalityId: input.municipalityId },
    );

    const image = await this.storage.store(file);
    try {
      const occurrence = await this.repository.create({
        input,
        userId: principal.sub,
        image,
        context,
        now: new Date(),
      });
      let aiAnalysis;
      if (this.aiProcessor !== undefined) {
        try {
          aiAnalysis = await this.aiProcessor.analyzeAfterCreation(occurrence.id);
        } catch (error) {
          logger.error(
            { err: error, occurrenceId: occurrence.id },
            'Falha ao registrar o fallback da analise de IA; a ocorrencia foi preservada.',
          );
        }
      }
      return {
        ...serializeDetailed(occurrence),
        nearbyCandidates: nearbyCandidates.items
          .filter((candidate) => !['PENDING_REVIEW', 'REJECTED'].includes(candidate.status))
          .map((candidate) => ({
            id: candidate.id,
            protocol: candidate.protocol,
            title: candidate.title,
            status: candidate.status,
          })),
        ...(aiAnalysis === undefined ? {} : { aiAnalysis }),
      };
    } catch (error) {
      await this.storage.delete(image.key).catch(() => undefined);
      throw error;
    }
  }

  public async list(
    principal: AuthenticatedPrincipal | undefined,
    query: OccurrenceListQuery,
  ): Promise<PaginatedOccurrences> {
    this.validateListCoordinates(query);
    this.validateDateRange(query.startDate, query.endDate);
    const visibility = visibilityForList(principal, query.municipalityId);
    const result = await this.repository.list(query, visibility);
    const detailed = principal !== undefined && !visibility.publicOnly;
    return {
      occurrences: result.items.map((item) =>
        detailed && canSeeDetailed(item, principal)
          ? serializeDetailed(item)
          : serializePublic(item),
      ),
      pagination: this.pagination(query.page, query.limit, result.total),
    };
  }

  public async nearby(
    principal: AuthenticatedPrincipal | undefined,
    query: NearbyQuery,
  ): Promise<PaginatedOccurrences> {
    const visibility = visibilityForList(principal, query.municipalityId);
    const result = await this.repository.nearby(query, visibility);
    const detailed = principal !== undefined && !visibility.publicOnly;
    return {
      occurrences: result.items.map((item) =>
        detailed && canSeeDetailed(item, principal)
          ? serializeDetailed(item)
          : serializePublic(item),
      ),
      pagination: this.pagination(query.page, query.limit, result.total),
    };
  }

  public async map(
    principal: AuthenticatedPrincipal | undefined,
    query: MapQuery,
  ): Promise<unknown> {
    this.validateDateRange(query.startDate, query.endDate);
    const visibility = visibilityForList(principal, query.municipalityId);
    const records = await this.repository.map(query, visibility);
    return {
      points: records.map((record) => ({
        id: record.id,
        protocol: record.protocol,
        title: record.title,
        status: record.status,
        category: record.categoryName,
        riskLevel: record.riskLevel,
        confirmationCount: record.confirmationCount,
        latitude: roundPublicCoordinate(record.latitude),
        longitude: roundPublicCoordinate(record.longitude),
      })),
    };
  }

  public async mine(
    principal: AuthenticatedPrincipal,
    query: OccurrenceListQuery,
  ): Promise<PaginatedOccurrences> {
    this.validateListCoordinates(query);
    this.validateDateRange(query.startDate, query.endDate);
    const result = await this.repository.list(query, {
      publicOnly: false,
      ownerId: principal.sub,
    });
    return {
      occurrences: result.items.map(serializeDetailed),
      pagination: this.pagination(query.page, query.limit, result.total),
    };
  }

  public async get(
    principal: AuthenticatedPrincipal | undefined,
    occurrenceId: string,
  ): Promise<unknown> {
    const occurrence = await this.requiredOccurrence(occurrenceId);
    if (!canSeeRecord(occurrence, principal)) {
      throw new AppError(404, 'OCCURRENCE_NOT_FOUND', 'Ocorrencia nao encontrada.');
    }
    return canSeeDetailed(occurrence, principal)
      ? serializeDetailed(occurrence)
      : serializePublic(occurrence);
  }

  public async update(
    principal: AuthenticatedPrincipal,
    occurrenceId: string,
    input: UpdateOccurrenceInput,
    context: RequestContext,
  ): Promise<unknown> {
    const occurrence = await this.requiredOccurrence(occurrenceId);
    const elevated = principal.role === 'ADMIN' || principal.role === 'MODERATOR';
    if (!elevated && principal.sub !== occurrence.createdBy) {
      throw new AppError(
        403,
        'OWNER_FORBIDDEN',
        'Somente o proprietario pode editar a ocorrencia.',
      );
    }
    if (!elevated && occurrence.status !== 'PENDING_REVIEW') {
      throw new AppError(
        409,
        'OCCURRENCE_NOT_EDITABLE',
        'A ocorrencia so pode ser editada pelo autor enquanto aguarda revisao.',
      );
    }
    const updated = await this.repository.update(
      occurrenceId,
      principal.sub,
      input,
      context,
      new Date(),
    );
    if (updated === null) {
      throw new AppError(404, 'OCCURRENCE_NOT_FOUND', 'Ocorrencia nao encontrada.');
    }
    return serializeDetailed(updated);
  }

  public async delete(
    principal: AuthenticatedPrincipal,
    occurrenceId: string,
    context: RequestContext,
  ): Promise<void> {
    if (principal.role !== 'ADMIN' && principal.role !== 'MODERATOR') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Somente moderadores ou administradores podem excluir ocorrencias.',
      );
    }
    if (!(await this.repository.softDelete(occurrenceId, principal.sub, context, new Date()))) {
      throw new AppError(404, 'OCCURRENCE_NOT_FOUND', 'Ocorrencia nao encontrada.');
    }
  }

  public async addImage(
    principal: AuthenticatedPrincipal,
    occurrenceId: string,
    file: UploadedFile,
    context: RequestContext,
  ): Promise<unknown> {
    const occurrence = await this.requiredOccurrence(occurrenceId);
    const allowed =
      principal.sub === occurrence.createdBy ||
      principal.role === 'ADMIN' ||
      principal.role === 'MODERATOR' ||
      (principal.role === 'CITY_OPERATOR' &&
        principal.municipalityId === occurrence.municipalityId);
    if (!allowed) {
      throw new AppError(
        403,
        'OWNER_FORBIDDEN',
        'Voce nao pode adicionar imagens a esta ocorrencia.',
      );
    }
    if ((await this.repository.countImages(occurrenceId)) >= env.MAX_IMAGES_PER_OCCURRENCE) {
      throw new AppError(
        409,
        'IMAGE_LIMIT_REACHED',
        `A ocorrencia aceita no maximo ${env.MAX_IMAGES_PER_OCCURRENCE} imagens.`,
      );
    }
    const image = await this.storage.store(file);
    try {
      const created = await this.repository.addImage(
        occurrenceId,
        principal.sub,
        image,
        env.MAX_IMAGES_PER_OCCURRENCE,
        context,
        new Date(),
      );
      if (created === null) {
        throw new AppError(404, 'OCCURRENCE_NOT_FOUND', 'Ocorrencia nao encontrada.');
      }
      return {
        id: created.id,
        url: `/api/v1/media/${created.id}`,
        mimeType: created.mimeType,
        imageType: created.imageType,
        moderationStatus: created.moderationStatus,
        createdAt: created.createdAt,
      };
    } catch (error) {
      await this.storage.delete(image.key).catch(() => undefined);
      if (error instanceof OccurrenceImageLimitError) {
        throw new AppError(
          409,
          'IMAGE_LIMIT_REACHED',
          `A ocorrencia aceita no maximo ${env.MAX_IMAGES_PER_OCCURRENCE} imagens.`,
        );
      }
      throw error;
    }
  }

  public async timeline(
    principal: AuthenticatedPrincipal | undefined,
    occurrenceId: string,
  ): Promise<unknown> {
    const occurrence = await this.requiredOccurrence(occurrenceId);
    if (!canSeeRecord(occurrence, principal)) {
      throw new AppError(404, 'OCCURRENCE_NOT_FOUND', 'Ocorrencia nao encontrada.');
    }
    const detailed = canSeeDetailed(occurrence, principal);
    const history = await this.repository.timeline(occurrenceId);
    return {
      timeline: history.map((item) => ({
        id: item.id,
        previousStatus: item.previousStatus,
        newStatus: item.newStatus,
        publicMessage: item.publicMessage,
        ...(detailed ? { reason: item.reason } : {}),
        createdAt: item.createdAt,
      })),
    };
  }

  private async requiredOccurrence(occurrenceId: string): Promise<OccurrenceRecord> {
    const occurrence = await this.repository.findById(occurrenceId);
    if (occurrence === null) {
      throw new AppError(404, 'OCCURRENCE_NOT_FOUND', 'Ocorrencia nao encontrada.');
    }
    return occurrence;
  }

  private validateListCoordinates(query: OccurrenceListQuery): void {
    const supplied = [query.latitude, query.longitude, query.radius].filter(
      (value) => value !== undefined,
    ).length;
    if (supplied !== 0 && supplied !== 3) {
      throw new AppError(
        422,
        'INCOMPLETE_LOCATION_FILTER',
        'latitude, longitude e radius devem ser enviados em conjunto.',
      );
    }
  }

  private validateDateRange(startDate?: Date, endDate?: Date): void {
    if (startDate !== undefined && endDate !== undefined && startDate > endDate) {
      throw new AppError(422, 'INVALID_DATE_RANGE', 'A data inicial deve anteceder a data final.');
    }
  }

  private pagination(page: number, limit: number, total: number) {
    return { page, limit, total, totalPages: Math.ceil(total / limit) };
  }
}
