import type { RequestContext } from '../auth/auth.types.js';
import type { RequestPrincipal } from '../occurrences/occurrences.types.js';
import type {
  CreateDepartmentInput,
  ListDepartmentsQuery,
  UpdateDepartmentInput,
} from './departments.schemas.js';

export interface DepartmentRecord {
  id: string;
  municipalityId: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentListFilters {
  municipalityId?: string;
  active?: boolean;
  limit: number;
  offset: number;
}

export interface DepartmentListResult {
  items: DepartmentRecord[];
  total: number;
}

export class DepartmentConflictError extends Error {
  public constructor() {
    super('Ja existe um departamento com este nome no municipio.');
    this.name = 'DepartmentConflictError';
  }
}

export interface DepartmentsRepository {
  isMunicipalityActive(municipalityId: string): Promise<boolean>;
  list(filters: DepartmentListFilters): Promise<DepartmentListResult>;
  findById(departmentId: string): Promise<DepartmentRecord | null>;
  create(
    actorId: string,
    input: CreateDepartmentInput,
    context: RequestContext,
    now: Date,
  ): Promise<DepartmentRecord>;
  update(
    actorId: string,
    departmentId: string,
    input: UpdateDepartmentInput,
    context: RequestContext,
    now: Date,
  ): Promise<DepartmentRecord | null>;
  setActive(
    actorId: string,
    departmentId: string,
    active: boolean,
    context: RequestContext,
    now: Date,
  ): Promise<DepartmentRecord | null>;
}

export interface DepartmentsService {
  list(principal: RequestPrincipal, query: ListDepartmentsQuery): Promise<unknown>;
  get(principal: RequestPrincipal, departmentId: string): Promise<unknown>;
  create(
    principal: RequestPrincipal,
    input: CreateDepartmentInput,
    context: RequestContext,
  ): Promise<unknown>;
  update(
    principal: RequestPrincipal,
    departmentId: string,
    input: UpdateDepartmentInput,
    context: RequestContext,
  ): Promise<unknown>;
  setActive(
    principal: RequestPrincipal,
    departmentId: string,
    active: boolean,
    context: RequestContext,
  ): Promise<unknown>;
  remove(principal: RequestPrincipal, departmentId: string, context: RequestContext): Promise<void>;
}
