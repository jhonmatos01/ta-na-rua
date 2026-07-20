/* eslint-disable @typescript-eslint/require-await */

import { randomUUID } from 'node:crypto';

import type {
  CreateRefreshTokenData,
  CreateUserData,
  IdentityRepository,
  UpdateProfileData,
  UserListFilters,
  UserListResult,
} from '../../src/modules/auth/identity.repository.js';
import { IdentityConflictError } from '../../src/modules/auth/identity.repository.js';
import type {
  RefreshTokenRecord,
  RequestContext,
  UserRecord,
  UserRole,
  UserStatus,
} from '../../src/modules/auth/auth.types.js';

interface StoredRefreshToken extends RefreshTokenRecord {
  lastUsedAt: Date | null;
}

export class InMemoryIdentityRepository implements IdentityRepository {
  public readonly users = new Map<string, UserRecord>();
  public readonly refreshTokens = new Map<string, StoredRefreshToken>();
  public readonly activeMunicipalities = new Set<string>();

  public addUser(user: UserRecord): void {
    this.users.set(user.id, user);
  }

  public async findUserByEmail(email: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((user) => user.email === email.toLowerCase()) ?? null;
  }

  public async findUserById(userId: string): Promise<UserRecord | null> {
    return this.users.get(userId) ?? null;
  }

  public async isMunicipalityActive(municipalityId: string): Promise<boolean> {
    return this.activeMunicipalities.has(municipalityId);
  }

  public async createUser(data: CreateUserData): Promise<UserRecord> {
    if ([...this.users.values()].some((user) => user.email === data.email)) {
      throw new IdentityConflictError('email');
    }
    if (data.phone !== null && [...this.users.values()].some((user) => user.phone === data.phone)) {
      throw new IdentityConflictError('phone');
    }
    const now = new Date();
    const user: UserRecord = {
      id: randomUUID(),
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash: data.passwordHash,
      role: 'CITIZEN',
      municipalityId: data.municipalityId,
      neighborhood: data.neighborhood,
      avatarUrl: null,
      status: 'ACTIVE',
      emailVerifiedAt: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.users.set(user.id, user);
    return user;
  }

  public async touchLastLogin(userId: string, at: Date): Promise<void> {
    const user = this.users.get(userId);
    if (user !== undefined) {
      this.users.set(userId, { ...user, lastLoginAt: at, updatedAt: at });
    }
  }

  public async createRefreshToken(data: CreateRefreshTokenData): Promise<void> {
    const token: StoredRefreshToken = {
      id: randomUUID(),
      sessionId: data.sessionId,
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null,
      lastUsedAt: null,
    };
    this.refreshTokens.set(token.id, token);
  }

  public async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return [...this.refreshTokens.values()].find((token) => token.tokenHash === tokenHash) ?? null;
  }

  public async rotateRefreshToken(
    currentTokenId: string,
    replacement: CreateRefreshTokenData,
    at: Date,
  ): Promise<boolean> {
    const current = this.refreshTokens.get(currentTokenId);
    if (
      current === undefined ||
      current.revokedAt !== null ||
      current.expiresAt.getTime() <= at.getTime()
    ) {
      return false;
    }
    this.refreshTokens.set(current.id, { ...current, revokedAt: at, lastUsedAt: at });
    await this.createRefreshToken(replacement);
    return true;
  }

  public async revokeSession(sessionId: string, at: Date): Promise<void> {
    for (const [id, token] of this.refreshTokens) {
      if (token.sessionId === sessionId && token.revokedAt === null) {
        this.refreshTokens.set(id, { ...token, revokedAt: at });
      }
    }
  }

  public async revokeTokenByHash(tokenHash: string, at: Date): Promise<void> {
    for (const [id, token] of this.refreshTokens) {
      if (token.tokenHash === tokenHash && token.revokedAt === null) {
        this.refreshTokens.set(id, { ...token, revokedAt: at });
      }
    }
  }

  public async revokeAllUserSessions(userId: string, at: Date): Promise<void> {
    for (const token of this.refreshTokens.values()) {
      if (token.userId === userId && token.revokedAt === null) {
        token.revokedAt = at;
      }
    }
  }

  public async isSessionActive(userId: string, sessionId: string, at: Date): Promise<boolean> {
    return [...this.refreshTokens.values()].some(
      (token) =>
        token.userId === userId &&
        token.sessionId === sessionId &&
        token.revokedAt === null &&
        token.expiresAt.getTime() > at.getTime(),
    );
  }

  public async updatePasswordAndRevokeSessions(
    userId: string,
    passwordHash: string,
    _context: RequestContext,
    at: Date,
  ): Promise<void> {
    const user = this.users.get(userId);
    if (user !== undefined) {
      this.users.set(userId, { ...user, passwordHash, updatedAt: at });
    }
    await this.revokeAllUserSessions(userId, at);
  }

  public async updateProfile(
    userId: string,
    data: UpdateProfileData,
    _context: RequestContext,
    at: Date,
  ): Promise<UserRecord> {
    if (
      data.phone !== null &&
      [...this.users.values()].some((user) => user.id !== userId && user.phone === data.phone)
    ) {
      throw new IdentityConflictError('phone');
    }
    const current = this.users.get(userId);
    if (current === undefined) {
      throw new Error('Usuario nao encontrado.');
    }
    const updated = { ...current, ...data, updatedAt: at };
    this.users.set(userId, updated);
    return updated;
  }

  public async deleteUser(userId: string, _context: RequestContext, at: Date): Promise<void> {
    const current = this.users.get(userId);
    if (current !== undefined) {
      this.users.set(userId, { ...current, status: 'DELETED', deletedAt: at, updatedAt: at });
    }
    await this.revokeAllUserSessions(userId, at);
  }

  public async listUsers(filters: UserListFilters): Promise<UserListResult> {
    const all = [...this.users.values()].filter(
      (user) =>
        user.deletedAt === null &&
        (filters.municipalityId === undefined || user.municipalityId === filters.municipalityId) &&
        (filters.role === undefined || user.role === filters.role) &&
        (filters.status === undefined || user.status === filters.status),
    );
    return {
      items: all.slice(filters.offset, filters.offset + filters.limit),
      total: all.length,
    };
  }

  public async updateUserStatus(
    _actorId: string,
    userId: string,
    status: UserStatus,
    _context: RequestContext,
    at: Date,
  ): Promise<UserRecord | null> {
    const current = this.users.get(userId);
    if (current === undefined) {
      return null;
    }
    const updated = { ...current, status, updatedAt: at };
    this.users.set(userId, updated);
    if (status !== 'ACTIVE') {
      await this.revokeAllUserSessions(userId, at);
    }
    return updated;
  }

  public async updateUserRole(
    _actorId: string,
    userId: string,
    role: UserRole,
    _context: RequestContext,
    at: Date,
  ): Promise<UserRecord | null> {
    const current = this.users.get(userId);
    if (current === undefined) {
      return null;
    }
    const updated = { ...current, role, updatedAt: at };
    this.users.set(userId, updated);
    await this.revokeAllUserSessions(userId, at);
    return updated;
  }
}

export function makeUser(overrides: Partial<UserRecord> = {}): UserRecord {
  const now = new Date('2026-07-18T12:00:00.000Z');
  return {
    id: randomUUID(),
    name: 'Usuario Teste',
    email: `usuario-${randomUUID()}@example.test`,
    phone: null,
    passwordHash: '',
    role: 'CITIZEN',
    municipalityId: randomUUID(),
    neighborhood: null,
    avatarUrl: null,
    status: 'ACTIVE',
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}
