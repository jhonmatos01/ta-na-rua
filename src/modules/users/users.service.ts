import { AppError } from '../../shared/errors/app-error.js';
import type {
  AuthenticatedPrincipal,
  RequestContext,
  SafeUser,
  UserRole,
  UserStatus,
} from '../auth/auth.types.js';
import { toSafeUser } from '../auth/auth.types.js';
import {
  IdentityConflictError,
  type IdentityRepository,
  type UserListResult,
} from '../auth/identity.repository.js';
import type { ListUsersQuery, UpdateProfileInput } from './users.schemas.js';

export interface SafeUserListResult {
  items: SafeUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UsersService {
  getMe(principal: AuthenticatedPrincipal): Promise<SafeUser>;
  updateMe(
    principal: AuthenticatedPrincipal,
    input: UpdateProfileInput,
    context: RequestContext,
  ): Promise<SafeUser>;
  deleteMe(principal: AuthenticatedPrincipal, context: RequestContext): Promise<void>;
  list(query: ListUsersQuery): Promise<SafeUserListResult>;
  getById(userId: string): Promise<SafeUser>;
  updateStatus(
    actor: AuthenticatedPrincipal,
    userId: string,
    status: UserStatus,
    context: RequestContext,
  ): Promise<SafeUser>;
  updateRole(
    actor: AuthenticatedPrincipal,
    userId: string,
    role: UserRole,
    context: RequestContext,
  ): Promise<SafeUser>;
}

function normalizePhone(phone: string | null | undefined): string | null | undefined {
  if (phone === undefined || phone === null) {
    return phone;
  }
  const digits = phone.replaceAll(/\D/gu, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Os dados enviados sao invalidos.', {
      fields: [{ field: 'phone', message: 'O telefone deve conter entre 10 e 15 digitos.' }],
    });
  }
  return `+${digits}`;
}

export class DefaultUsersService implements UsersService {
  public constructor(
    private readonly repository: IdentityRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async getMe(principal: AuthenticatedPrincipal): Promise<SafeUser> {
    return this.getById(principal.sub);
  }

  public async updateMe(
    principal: AuthenticatedPrincipal,
    input: UpdateProfileInput,
    context: RequestContext,
  ): Promise<SafeUser> {
    const current = await this.repository.findUserById(principal.sub);
    if (current === null || current.deletedAt !== null) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Usuario nao encontrado.');
    }
    const municipalityId =
      input.municipalityId === undefined ? current.municipalityId : input.municipalityId;
    const phone = normalizePhone(input.phone);
    if (municipalityId !== null && !(await this.repository.isMunicipalityActive(municipalityId))) {
      throw new AppError(
        422,
        'INVALID_MUNICIPALITY',
        'O municipio informado e invalido ou inativo.',
      );
    }
    try {
      return toSafeUser(
        await this.repository.updateProfile(
          current.id,
          {
            name: input.name ?? current.name,
            phone: phone === undefined ? current.phone : phone,
            municipalityId,
            neighborhood:
              input.neighborhood === undefined ? current.neighborhood : input.neighborhood,
            avatarUrl: input.avatarUrl === undefined ? current.avatarUrl : input.avatarUrl,
          },
          context,
          this.now(),
        ),
      );
    } catch (error) {
      if (error instanceof IdentityConflictError) {
        throw new AppError(409, 'USER_ALREADY_EXISTS', 'Ja existe um usuario com estes dados.', {
          field: error.field,
        });
      }
      throw error;
    }
  }

  public async deleteMe(principal: AuthenticatedPrincipal, context: RequestContext): Promise<void> {
    await this.repository.deleteUser(principal.sub, context, this.now());
  }

  public async list(query: ListUsersQuery): Promise<SafeUserListResult> {
    const result: UserListResult = await this.repository.listUsers({
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
      ...(query.municipalityId === undefined ? {} : { municipalityId: query.municipalityId }),
      ...(query.role === undefined ? {} : { role: query.role }),
      ...(query.status === undefined ? {} : { status: query.status }),
    });
    return {
      items: result.items.map(toSafeUser),
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  public async getById(userId: string): Promise<SafeUser> {
    const user = await this.repository.findUserById(userId);
    if (user === null || user.deletedAt !== null) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Usuario nao encontrado.');
    }
    return toSafeUser(user);
  }

  public async updateStatus(
    actor: AuthenticatedPrincipal,
    userId: string,
    status: UserStatus,
    context: RequestContext,
  ): Promise<SafeUser> {
    if (actor.sub === userId && status !== 'ACTIVE') {
      throw new AppError(
        422,
        'SELF_STATUS_CHANGE_FORBIDDEN',
        'O administrador nao pode bloquear a si mesmo.',
      );
    }
    const user = await this.repository.updateUserStatus(
      actor.sub,
      userId,
      status,
      context,
      this.now(),
    );
    if (user === null) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Usuario nao encontrado.');
    }
    return toSafeUser(user);
  }

  public async updateRole(
    actor: AuthenticatedPrincipal,
    userId: string,
    role: UserRole,
    context: RequestContext,
  ): Promise<SafeUser> {
    if (actor.sub === userId && role !== 'ADMIN') {
      throw new AppError(
        422,
        'SELF_ROLE_CHANGE_FORBIDDEN',
        'O administrador nao pode remover o proprio perfil.',
      );
    }
    const user = await this.repository.updateUserRole(actor.sub, userId, role, context, this.now());
    if (user === null) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Usuario nao encontrado.');
    }
    return toSafeUser(user);
  }
}
