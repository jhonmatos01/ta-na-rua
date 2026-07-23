import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { AppError } from '../../src/shared/errors/app-error.js';
import type { AuthenticatedPrincipal } from '../../src/modules/auth/auth.types.js';
import type { ImageStorage } from '../../src/modules/occurrences/image-storage.js';
import { DefaultOccurrencesService } from '../../src/modules/occurrences/occurrences.service.js';
import {
  OccurrenceImageLimitError,
  type CreateOccurrenceData,
  type HistoryRecord,
  type LocationValidation,
  type OccurrenceImageRecord,
  type OccurrenceListResult,
  type OccurrenceRecord,
  type OccurrenceRepository,
  type OccurrenceVisibility,
  type StoredImage,
  type UploadedFile,
} from '../../src/modules/occurrences/occurrences.types.js';
import type {
  CreateOccurrenceInput,
  MapQuery,
  NearbyQuery,
  OccurrenceListQuery,
  UpdateOccurrenceInput,
} from '../../src/modules/occurrences/occurrences.schemas.js';

const municipalityId = randomUUID();
const ownerId = randomUUID();

function principal(overrides: Partial<AuthenticatedPrincipal> = {}): AuthenticatedPrincipal {
  return {
    sub: ownerId,
    role: 'CITIZEN',
    municipalityId,
    sessionId: randomUUID(),
    ...overrides,
  };
}

function record(overrides: Partial<OccurrenceRecord> = {}): OccurrenceRecord {
  const now = new Date('2026-07-19T12:00:00.000Z');
  return {
    id: randomUUID(),
    protocol: 'TNR-2026-000001',
    title: 'Buraco na via',
    description: 'Pavimento danificado',
    categoryId: randomUUID(),
    categoryName: 'Buraco em via',
    municipalityId,
    municipalityName: 'Salvador',
    neighborhoodId: null,
    neighborhoodName: null,
    neighborhoodText: 'Centro',
    createdBy: ownerId,
    status: 'PUBLISHED',
    severity: 3,
    priorityScore: 20,
    riskLevel: 'MEDIUM',
    address: 'Rua das Flores, 123, apto 4',
    latitude: -12.971456,
    longitude: -38.501234,
    locationAccuracy: 8,
    anonymousPublication: false,
    confirmationCount: 2,
    firstReportedAt: now,
    createdAt: now,
    updatedAt: now,
    images: [],
    ...overrides,
  };
}

class FakeStorage implements ImageStorage {
  public stored = 0;
  public deleted: string[] = [];

  public store(file: UploadedFile): Promise<StoredImage> {
    this.stored += 1;
    return Promise.resolve({
      key: 'occurrences/2026/image.png',
      url: '/uploads/occurrences/2026/image.png',
      mimeType: 'image/png',
      size: file.size,
    });
  }

  public delete(key: string): Promise<void> {
    this.deleted.push(key);
    return Promise.resolve();
  }
}

class FakeRepository implements OccurrenceRepository {
  public occurrence: OccurrenceRecord | null = record();
  public validation: LocationValidation = {
    municipalityExists: true,
    declaredMunicipalityIsNearest: true,
    distanceMeters: 100,
    neighborhoodMatches: true,
    categoryExists: true,
  };
  public total = 1;
  public listItems: OccurrenceRecord[] | null = null;
  public imageCount = 0;
  public createError: Error | null = null;
  public addImageError: Error | null = null;
  public updateReturnsNull = false;
  public softDeleteResult: boolean | null = null;
  public addImageReturnsNull = false;
  public lastVisibility: OccurrenceVisibility | null = null;

  public validateLocationAndReferences(): Promise<LocationValidation> {
    return Promise.resolve(this.validation);
  }

  public create(_data: CreateOccurrenceData): Promise<OccurrenceRecord> {
    if (this.createError !== null) return Promise.reject(this.createError);
    return Promise.resolve(this.occurrence!);
  }

  public findById(): Promise<OccurrenceRecord | null> {
    return Promise.resolve(this.occurrence);
  }

  public list(
    _query: OccurrenceListQuery,
    visibility: OccurrenceVisibility,
  ): Promise<OccurrenceListResult> {
    this.lastVisibility = visibility;
    return Promise.resolve({
      items: this.listItems ?? (this.occurrence === null ? [] : [this.occurrence]),
      total: this.total,
    });
  }

  public nearby(
    _query: NearbyQuery,
    visibility: OccurrenceVisibility,
  ): Promise<OccurrenceListResult> {
    return this.list({ page: 1, limit: 20 }, visibility);
  }

  public map(_query: MapQuery, visibility: OccurrenceVisibility): Promise<OccurrenceRecord[]> {
    this.lastVisibility = visibility;
    return Promise.resolve(this.occurrence === null ? [] : [this.occurrence]);
  }

  public update(
    _occurrenceId: string,
    _actorId: string,
    input: UpdateOccurrenceInput,
  ): Promise<OccurrenceRecord | null> {
    if (this.updateReturnsNull) return Promise.resolve(null);
    if (this.occurrence === null) return Promise.resolve(null);
    this.occurrence = { ...this.occurrence, ...input };
    return Promise.resolve(this.occurrence);
  }

  public softDelete(): Promise<boolean> {
    return Promise.resolve(this.softDeleteResult ?? this.occurrence !== null);
  }

  public countImages(): Promise<number> {
    return Promise.resolve(this.imageCount);
  }

  public addImage(): Promise<OccurrenceImageRecord | null> {
    if (this.addImageError !== null) return Promise.reject(this.addImageError);
    if (this.addImageReturnsNull) return Promise.resolve(null);
    return Promise.resolve({
      id: randomUUID(),
      fileUrl: '/uploads/image.png',
      mimeType: 'image/png',
      fileSize: 10,
      imageType: 'UPDATE',
      moderationStatus: 'PENDING',
      createdAt: new Date(),
    });
  }

  public timeline(): Promise<HistoryRecord[]> {
    return Promise.resolve([
      {
        id: randomUUID(),
        previousStatus: null,
        newStatus: 'PENDING_REVIEW',
        reason: 'motivo interno',
        publicMessage: 'Recebida',
        createdAt: new Date(),
      },
    ]);
  }
}

const input: CreateOccurrenceInput = {
  title: 'Buraco na via',
  municipalityId,
  latitude: -12.97,
  longitude: -38.5,
  anonymousPublication: false,
};
const file: UploadedFile = {
  buffer: Buffer.from('imagem'),
  declaredMimeType: 'image/png',
  size: 6,
};
const context = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

describe('servico de ocorrencias', () => {
  it('cria a ocorrencia e devolve a localizacao exata ao autor', async () => {
    const repository = new FakeRepository();
    repository.occurrence = record({ status: 'PENDING_REVIEW' });
    repository.listItems = [record({ status: 'PUBLISHED' })];
    const storage = new FakeStorage();
    const result = (await new DefaultOccurrencesService(repository, storage).create(
      principal(),
      input,
      file,
      context,
    )) as {
      createdBy: string;
      location: { approximate: boolean };
      nearbyCandidates: unknown[];
    };
    expect(result.createdBy).toBe(ownerId);
    expect(result.location.approximate).toBe(false);
    expect(result.nearbyCandidates).toHaveLength(1);
    expect(storage.stored).toBe(1);
  });

  it('remove imagem orfa quando a transacao falha', async () => {
    const repository = new FakeRepository();
    repository.createError = new Error('falha no banco');
    const storage = new FakeStorage();
    await expect(
      new DefaultOccurrencesService(repository, storage).create(principal(), input, file, context),
    ).rejects.toThrow('falha no banco');
    expect(storage.deleted).toEqual(['occurrences/2026/image.png']);
  });

  it('preserva a ocorrencia quando o processamento posterior da IA falha', async () => {
    const repository = new FakeRepository();
    repository.occurrence = record({ status: 'PENDING_REVIEW' });
    const result = (await new DefaultOccurrencesService(repository, new FakeStorage(), {
      analyzeAfterCreation: () => Promise.reject(new Error('IA indisponivel')),
    }).create(principal(), input, file, context)) as { id: string; status: string };
    expect(result.id).toBe(repository.occurrence.id);
    expect(result.status).toBe('PENDING_REVIEW');
  });

  it('inclui o estado seguro da analise quando o processamento termina', async () => {
    const repository = new FakeRepository();
    repository.occurrence = record({ status: 'PENDING_REVIEW' });
    const result = (await new DefaultOccurrencesService(repository, new FakeStorage(), {
      analyzeAfterCreation: () =>
        Promise.resolve({
          analysisId: randomUUID(),
          state: 'TIMEOUT',
          attempts: 2,
          appliedClassification: false,
          requiresHumanReview: true,
          confidence: 0,
          possibleDuplicateCount: 0,
        }),
    }).create(principal(), input, file, context)) as {
      aiAnalysis: { state: string; requiresHumanReview: boolean };
    };
    expect(result.aiAnalysis).toEqual(
      expect.objectContaining({ state: 'TIMEOUT', requiresHumanReview: true }),
    );
  });

  it.each([
    ['municipio', { municipalityExists: false }, 'INVALID_MUNICIPALITY'],
    ['coordenadas', { declaredMunicipalityIsNearest: false }, 'LOCATION_OUTSIDE_MUNICIPALITY'],
    ['distancia ausente', { distanceMeters: null }, 'LOCATION_OUTSIDE_MUNICIPALITY'],
    ['distancia excessiva', { distanceMeters: 100_001 }, 'LOCATION_OUTSIDE_MUNICIPALITY'],
    ['bairro', { neighborhoodMatches: false }, 'INVALID_NEIGHBORHOOD'],
    ['categoria', { categoryExists: false }, 'INVALID_CATEGORY'],
  ])('rejeita %s invalido', async (_label, override, code) => {
    const repository = new FakeRepository();
    repository.validation = { ...repository.validation, ...override };
    await expect(
      new DefaultOccurrencesService(repository, new FakeStorage()).create(
        principal(),
        input,
        file,
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 422, code });
  });

  it('remove numero, autor e precisao da resposta publica', async () => {
    const repository = new FakeRepository();
    const result = (await new DefaultOccurrencesService(repository, new FakeStorage()).get(
      undefined,
      repository.occurrence!.id,
    )) as Record<string, unknown> & { location: Record<string, unknown> };
    expect(result).not.toHaveProperty('createdBy');
    expect(result.address).toBe('Rua das Flores');
    expect(result.location).toEqual({ latitude: -12.9715, longitude: -38.5012, approximate: true });
    expect(result.location).not.toHaveProperty('accuracy');
  });

  it('serializa campos opcionais e remove endereco sem parte publica util', async () => {
    const repository = new FakeRepository();
    repository.occurrence = record({
      categoryId: null,
      categoryName: null,
      neighborhoodId: randomUUID(),
      neighborhoodName: 'Barra',
      neighborhoodText: null,
      address: '123',
      distanceMeters: 12.34,
      images: [
        {
          id: randomUUID(),
          fileUrl: '/uploads/image.png',
          mimeType: 'image/png',
          fileSize: 10,
          imageType: 'REPORT',
          moderationStatus: 'APPROVED',
          createdAt: new Date('2026-07-20T12:00:00.000Z'),
        },
      ],
    });

    const result = (await new DefaultOccurrencesService(repository, new FakeStorage()).get(
      undefined,
      repository.occurrence.id,
    )) as Record<string, unknown>;

    expect(result).toMatchObject({
      category: null,
      neighborhood: { id: repository.occurrence.neighborhoodId, name: 'Barra' },
      address: null,
      distanceMeters: 12.34,
    });
    expect(result.images).toHaveLength(1);
  });

  it('oculta ocorrencia pendente de terceiros e permite ao autor', async () => {
    const repository = new FakeRepository();
    repository.occurrence = record({ status: 'PENDING_REVIEW' });
    const service = new DefaultOccurrencesService(repository, new FakeStorage());
    await expect(service.get(undefined, repository.occurrence.id)).rejects.toMatchObject<AppError>({
      statusCode: 404,
      code: 'OCCURRENCE_NOT_FOUND',
    });
    const own = (await service.get(principal(), repository.occurrence.id)) as Record<
      string,
      unknown
    >;
    expect(own.createdBy).toBe(ownerId);
  });

  it('aplica paginacao e exige o trio completo de filtros geograficos', async () => {
    const repository = new FakeRepository();
    repository.total = 21;
    const service = new DefaultOccurrencesService(repository, new FakeStorage());
    const result = await service.list(undefined, { page: 2, limit: 10 });
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
    await expect(
      service.list(undefined, { page: 1, limit: 20, latitude: -12.97 }),
    ).rejects.toMatchObject<AppError>({ code: 'INCOMPLETE_LOCATION_FILTER' });
  });

  it('isola operador municipal e libera moderador global', async () => {
    const repository = new FakeRepository();
    const service = new DefaultOccurrencesService(repository, new FakeStorage());
    await expect(
      service.list(principal({ role: 'CITY_OPERATOR' }), {
        page: 1,
        limit: 20,
        municipalityId: randomUUID(),
      }),
    ).rejects.toMatchObject<AppError>({ statusCode: 403, code: 'MUNICIPALITY_FORBIDDEN' });
    await service.list(principal({ role: 'MODERATOR' }), { page: 1, limit: 20 });
    expect(repository.lastVisibility).toEqual({ publicOnly: false });
  });

  it('exige municipio do operador e retorna detalhes somente no municipio permitido', async () => {
    const repository = new FakeRepository();
    const service = new DefaultOccurrencesService(repository, new FakeStorage());

    await expect(
      service.list(principal({ role: 'CITY_OPERATOR', municipalityId: null }), {
        page: 1,
        limit: 20,
      }),
    ).rejects.toMatchObject<AppError>({ statusCode: 403, code: 'MUNICIPALITY_REQUIRED' });

    const result = await service.nearby(principal({ role: 'CITY_OPERATOR' }), {
      page: 1,
      limit: 20,
      latitude: -12.97,
      longitude: -38.5,
      radius: 30,
    });
    expect(result.occurrences[0]).toMatchObject({
      createdBy: ownerId,
      location: { approximate: false },
    });
    expect(repository.lastVisibility).toEqual({ publicOnly: false, municipalityId });
  });

  it('valida periodos e serializa mapa, ocorrencias proprias e confirmadas', async () => {
    const repository = new FakeRepository();
    const service = new DefaultOccurrencesService(repository, new FakeStorage());
    const startDate = new Date('2026-07-21T00:00:00.000Z');
    const endDate = new Date('2026-07-20T00:00:00.000Z');

    await expect(service.map(undefined, { startDate, endDate })).rejects.toMatchObject<AppError>({
      code: 'INVALID_DATE_RANGE',
    });
    await expect(
      service.mine(principal(), { page: 1, limit: 20, startDate, endDate }),
    ).rejects.toMatchObject<AppError>({ code: 'INVALID_DATE_RANGE' });

    const map = (await service.map(undefined, {})) as {
      points: Array<{ latitude: number; longitude: number }>;
    };
    expect(map.points[0]).toMatchObject({ latitude: -12.9715, longitude: -38.5012 });

    const mine = await service.mine(principal(), { page: 1, limit: 20 });
    expect(mine.occurrences[0]).toMatchObject({ createdBy: ownerId });
    expect(repository.lastVisibility).toEqual({ publicOnly: false, ownerId });

    const confirmed = await service.confirmedByMe(principal(), { page: 1, limit: 20 });
    expect(confirmed.occurrences[0]).not.toHaveProperty('createdBy');
    expect(confirmed.occurrences[0]).toMatchObject({
      address: 'Rua das Flores',
      location: { approximate: true },
    });
    expect(repository.lastVisibility).toEqual({ publicOnly: true, confirmerId: ownerId });
  });

  it('permite editar ao autor apenas enquanto aguarda revisao', async () => {
    const repository = new FakeRepository();
    const service = new DefaultOccurrencesService(repository, new FakeStorage());
    await expect(
      service.update(principal(), repository.occurrence!.id, { title: 'Novo titulo' }, context),
    ).rejects.toMatchObject<AppError>({ statusCode: 409, code: 'OCCURRENCE_NOT_EDITABLE' });
    repository.occurrence = record({ status: 'PENDING_REVIEW' });
    const updated = (await service.update(
      principal(),
      repository.occurrence.id,
      { title: 'Novo titulo' },
      context,
    )) as { title: string };
    expect(updated.title).toBe('Novo titulo');
  });

  it('rejeita edicao de terceiro, permite moderador e trata desaparecimento concorrente', async () => {
    const repository = new FakeRepository();
    repository.occurrence = record({ status: 'PENDING_REVIEW' });
    const service = new DefaultOccurrencesService(repository, new FakeStorage());

    await expect(
      service.update(
        principal({ sub: randomUUID() }),
        repository.occurrence.id,
        { title: 'Tentativa' },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 403, code: 'OWNER_FORBIDDEN' });

    const updated = (await service.update(
      principal({ sub: randomUUID(), role: 'MODERATOR' }),
      repository.occurrence.id,
      { title: 'Revisao oficial' },
      context,
    )) as { title: string };
    expect(updated.title).toBe('Revisao oficial');

    repository.updateReturnsNull = true;
    await expect(
      service.update(
        principal({ role: 'MODERATOR' }),
        repository.occurrence.id,
        { title: 'Desapareceu' },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 404, code: 'OCCURRENCE_NOT_FOUND' });
  });

  it('reserva exclusao a moderador/admin e limita imagens', async () => {
    const repository = new FakeRepository();
    const storage = new FakeStorage();
    const service = new DefaultOccurrencesService(repository, storage);
    await expect(
      service.delete(principal(), repository.occurrence!.id, context),
    ).rejects.toMatchObject<AppError>({ statusCode: 403 });
    repository.imageCount = 5;
    await expect(
      service.addImage(principal(), repository.occurrence!.id, file, context),
    ).rejects.toMatchObject<AppError>({ statusCode: 409, code: 'IMAGE_LIMIT_REACHED' });
    expect(storage.stored).toBe(0);
  });

  it('conclui exclusao privilegiada e informa ocorrencia ausente', async () => {
    const repository = new FakeRepository();
    const service = new DefaultOccurrencesService(repository, new FakeStorage());

    await expect(
      service.delete(principal({ role: 'ADMIN' }), repository.occurrence!.id, context),
    ).resolves.toBeUndefined();
    repository.softDeleteResult = false;
    await expect(
      service.delete(principal({ role: 'MODERATOR' }), randomUUID(), context),
    ).rejects.toMatchObject<AppError>({ statusCode: 404, code: 'OCCURRENCE_NOT_FOUND' });
  });

  it('protege inclusao de imagem e devolve a imagem criada', async () => {
    const repository = new FakeRepository();
    const storage = new FakeStorage();
    const service = new DefaultOccurrencesService(repository, storage);

    await expect(
      service.addImage(
        principal({ sub: randomUUID(), municipalityId: randomUUID() }),
        repository.occurrence!.id,
        file,
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 403, code: 'OWNER_FORBIDDEN' });

    const result = (await service.addImage(
      principal({ role: 'CITY_OPERATOR' }),
      repository.occurrence!.id,
      file,
      context,
    )) as Record<string, unknown>;
    expect(result).toMatchObject({
      url: '/uploads/image.png',
      mimeType: 'image/png',
      imageType: 'UPDATE',
      moderationStatus: 'PENDING',
    });
  });

  it('remove imagem quando a ocorrencia desaparece durante a inclusao', async () => {
    const repository = new FakeRepository();
    repository.addImageReturnsNull = true;
    const storage = new FakeStorage();

    await expect(
      new DefaultOccurrencesService(repository, storage).addImage(
        principal(),
        repository.occurrence!.id,
        file,
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 404, code: 'OCCURRENCE_NOT_FOUND' });
    expect(storage.deleted).toEqual(['occurrences/2026/image.png']);
  });

  it('remove o objeto quando a verificacao atomica detecta limite concorrente', async () => {
    const repository = new FakeRepository();
    repository.addImageError = new OccurrenceImageLimitError();
    const storage = new FakeStorage();
    await expect(
      new DefaultOccurrencesService(repository, storage).addImage(
        principal(),
        repository.occurrence!.id,
        file,
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 409, code: 'IMAGE_LIMIT_REACHED' });
    expect(storage.deleted).toEqual(['occurrences/2026/image.png']);
  });

  it('nao publica motivo interno na linha do tempo', async () => {
    const repository = new FakeRepository();
    const service = new DefaultOccurrencesService(repository, new FakeStorage());
    const publicResult = (await service.timeline(undefined, repository.occurrence!.id)) as {
      timeline: Record<string, unknown>[];
    };
    expect(publicResult.timeline[0]).not.toHaveProperty('reason');
    const adminResult = (await service.timeline(
      principal({ role: 'ADMIN' }),
      repository.occurrence!.id,
    )) as { timeline: Record<string, unknown>[] };
    expect(adminResult.timeline[0]?.reason).toBe('motivo interno');
  });

  it('retorna 404 para ocorrencia inexistente em detalhes e timeline', async () => {
    const repository = new FakeRepository();
    repository.occurrence = null;
    const service = new DefaultOccurrencesService(repository, new FakeStorage());

    await expect(service.get(undefined, randomUUID())).rejects.toMatchObject<AppError>({
      statusCode: 404,
      code: 'OCCURRENCE_NOT_FOUND',
    });
    await expect(service.timeline(undefined, randomUUID())).rejects.toMatchObject<AppError>({
      statusCode: 404,
      code: 'OCCURRENCE_NOT_FOUND',
    });
  });
});
