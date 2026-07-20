import { AppError } from '../../shared/errors/app-error.js';
import type { RequestContext } from '../auth/auth.types.js';
import type { RequestPrincipal } from '../occurrences/occurrences.types.js';
import type {
  CreateDepartmentInput,
  ListDepartmentsQuery,
  UpdateDepartmentInput,
} from './departments.schemas.js';
import {
  DepartmentConflictError,
  type DepartmentRecord,
  type DepartmentsRepository,
  type DepartmentsService,
} from './departments.types.js';

function serialize(department: DepartmentRecord) {
  return {
    id: department.id,
    municipalityId: department.municipalityId,
    name: department.name,
    description: department.description,
    active: department.active,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt,
  };
}

export class DefaultDepartmentsService implements DepartmentsService {
  public constructor(
    private readonly repository: DepartmentsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(principal: RequestPrincipal, query: ListDepartmentsQuery): Promise<unknown> {
    this.requireOperational(principal);
    const municipalityId = this.scopedMunicipality(principal, query.municipalityId);
    const result = await this.repository.list({
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
      ...(municipalityId === undefined ? {} : { municipalityId }),
      ...(query.active === undefined ? {} : { active: query.active }),
    });
    return {
      departments: result.items.map(serialize),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  public async get(principal: RequestPrincipal, departmentId: string): Promise<unknown> {
    this.requireOperational(principal);
    return { department: serialize(await this.requiredScoped(principal, departmentId)) };
  }

  public async create(
    principal: RequestPrincipal,
    input: CreateDepartmentInput,
    context: RequestContext,
  ): Promise<unknown> {
    this.requireOperational(principal);
    this.scopedMunicipality(principal, input.municipalityId);
    if (!(await this.repository.isMunicipalityActive(input.municipalityId))) {
      throw new AppError(
        422,
        'INVALID_MUNICIPALITY',
        'O municipio informado e invalido ou inativo.',
      );
    }
    try {
      return {
        department: serialize(
          await this.repository.create(principal.sub, input, context, this.now()),
        ),
      };
    } catch (error) {
      this.handleConflict(error);
    }
  }

  public async update(
    principal: RequestPrincipal,
    departmentId: string,
    input: UpdateDepartmentInput,
    context: RequestContext,
  ): Promise<unknown> {
    await this.requiredScoped(principal, departmentId);
    try {
      const department = await this.repository.update(
        principal.sub,
        departmentId,
        input,
        context,
        this.now(),
      );
      if (department === null) this.notFound();
      return { department: serialize(department) };
    } catch (error) {
      this.handleConflict(error);
    }
  }

  public async setActive(
    principal: RequestPrincipal,
    departmentId: string,
    active: boolean,
    context: RequestContext,
  ): Promise<unknown> {
    await this.requiredScoped(principal, departmentId);
    const department = await this.repository.setActive(
      principal.sub,
      departmentId,
      active,
      context,
      this.now(),
    );
    if (department === null) this.notFound();
    return { department: serialize(department) };
  }

  public async remove(
    principal: RequestPrincipal,
    departmentId: string,
    context: RequestContext,
  ): Promise<void> {
    await this.setActive(principal, departmentId, false, context);
  }

  private requireOperational(principal: RequestPrincipal): void {
    if (principal.role === 'CITIZEN') {
      throw new AppError(403, 'FORBIDDEN', 'Seu perfil nao gerencia departamentos.');
    }
  }

  private scopedMunicipality(
    principal: RequestPrincipal,
    requested: string | undefined,
  ): string | undefined {
    if (principal.role !== 'CITY_OPERATOR') return requested;
    if (
      principal.municipalityId === null ||
      (requested !== undefined && requested !== principal.municipalityId)
    ) {
      throw new AppError(403, 'MUNICIPALITY_FORBIDDEN', 'Acesso negado para este municipio.');
    }
    return principal.municipalityId;
  }

  private async requiredScoped(
    principal: RequestPrincipal,
    departmentId: string,
  ): Promise<DepartmentRecord> {
    this.requireOperational(principal);
    const department = await this.repository.findById(departmentId);
    if (department === null) this.notFound();
    this.scopedMunicipality(principal, department.municipalityId);
    return department;
  }

  private handleConflict(error: unknown): never {
    if (error instanceof DepartmentConflictError) {
      throw new AppError(
        409,
        'DEPARTMENT_ALREADY_EXISTS',
        'Ja existe um departamento com este nome no municipio.',
      );
    }
    throw error;
  }

  private notFound(): never {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Departamento nao encontrado.');
  }
}
