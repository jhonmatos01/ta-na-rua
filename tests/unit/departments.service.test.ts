import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { DefaultDepartmentsService } from '../../src/modules/departments/departments.service.js';
import {
  DepartmentConflictError,
  type DepartmentListFilters,
  type DepartmentListResult,
  type DepartmentRecord,
  type DepartmentsRepository,
} from '../../src/modules/departments/departments.types.js';
import type { RequestPrincipal } from '../../src/modules/occurrences/occurrences.types.js';
import type { AppError } from '../../src/shared/errors/app-error.js';

const municipalityId = randomUUID();
const now = new Date('2026-07-19T15:00:00.000Z');
const context = { ipAddress: null, userAgent: 'vitest' };

function department(overrides: Partial<DepartmentRecord> = {}): DepartmentRecord {
  return {
    id: randomUUID(),
    municipalityId,
    name: 'Manutencao Urbana',
    description: null,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FakeDepartmentsRepository implements DepartmentsRepository {
  public item = department();
  public municipalityActive = true;
  public conflict = false;
  public receivedFilters: DepartmentListFilters | null = null;

  public isMunicipalityActive(): Promise<boolean> {
    return Promise.resolve(this.municipalityActive);
  }
  public list(filters: DepartmentListFilters): Promise<DepartmentListResult> {
    this.receivedFilters = filters;
    return Promise.resolve({ items: [this.item], total: 1 });
  }
  public findById(): Promise<DepartmentRecord | null> {
    return Promise.resolve(this.item);
  }
  public create(): Promise<DepartmentRecord> {
    if (this.conflict) return Promise.reject(new DepartmentConflictError());
    return Promise.resolve(this.item);
  }
  public update(): Promise<DepartmentRecord | null> {
    if (this.conflict) return Promise.reject(new DepartmentConflictError());
    return Promise.resolve(this.item);
  }
  public setActive(
    _actorId: string,
    _departmentId: string,
    active: boolean,
  ): Promise<DepartmentRecord | null> {
    return Promise.resolve({ ...this.item, active });
  }
}

function principal(overrides: Partial<RequestPrincipal> = {}): RequestPrincipal {
  return { sub: randomUUID(), role: 'CITY_OPERATOR', municipalityId, ...overrides };
}

describe('DefaultDepartmentsService', () => {
  it('forca o municipio do operador na listagem', async () => {
    const repository = new FakeDepartmentsRepository();
    const service = new DefaultDepartmentsService(repository, () => now);
    await service.list(principal(), { page: 1, limit: 20 });
    expect(repository.receivedFilters).toMatchObject({ municipalityId, limit: 20, offset: 0 });
  });

  it('impede cidadao e operador de outro municipio', async () => {
    const repository = new FakeDepartmentsRepository();
    const service = new DefaultDepartmentsService(repository, () => now);
    await expect(
      service.list(principal({ role: 'CITIZEN' }), { page: 1, limit: 20 }),
    ).rejects.toMatchObject<AppError>({ statusCode: 403, code: 'FORBIDDEN' });
    await expect(
      service.list(principal(), { municipalityId: randomUUID(), page: 1, limit: 20 }),
    ).rejects.toMatchObject<AppError>({ statusCode: 403, code: 'MUNICIPALITY_FORBIDDEN' });
  });

  it('cria departamento apenas em municipio ativo', async () => {
    const repository = new FakeDepartmentsRepository();
    repository.municipalityActive = false;
    const service = new DefaultDepartmentsService(repository, () => now);
    await expect(
      service.create(
        principal({ role: 'ADMIN' }),
        { municipalityId, name: 'Novo setor', description: null },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 422, code: 'INVALID_MUNICIPALITY' });
  });

  it('mapeia nome duplicado para conflito 409', async () => {
    const repository = new FakeDepartmentsRepository();
    repository.conflict = true;
    const service = new DefaultDepartmentsService(repository, () => now);
    await expect(
      service.create(
        principal(),
        { municipalityId, name: 'Manutencao Urbana', description: null },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 409, code: 'DEPARTMENT_ALREADY_EXISTS' });
  });

  it('ativa, desativa e remove por inativacao', async () => {
    const repository = new FakeDepartmentsRepository();
    const service = new DefaultDepartmentsService(repository, () => now);
    await expect(
      service.setActive(principal(), repository.item.id, false, context),
    ).resolves.toMatchObject({ department: { active: false } });
    await expect(
      service.setActive(principal(), repository.item.id, true, context),
    ).resolves.toMatchObject({ department: { active: true } });
    await expect(service.remove(principal(), repository.item.id, context)).resolves.toBeUndefined();
  });
});
