import { randomUUID } from 'node:crypto';

import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { ChangePasswordInput, LoginInput, RegisterInput } from './auth.schemas.js';
import {
  createOpaqueRefreshToken,
  hashPassword,
  hashRefreshToken,
  signAccessToken,
  verifyPassword,
} from './auth.security.js';
import type {
  AuthenticatedPrincipal,
  AuthenticatedSession,
  RequestContext,
  SafeUser,
  SessionTokens,
  UserRecord,
} from './auth.types.js';
import { toSafeUser } from './auth.types.js';
import { IdentityConflictError, type IdentityRepository } from './identity.repository.js';

export interface AuthService {
  register(input: RegisterInput): Promise<SafeUser>;
  login(input: LoginInput, context: RequestContext): Promise<AuthenticatedSession>;
  refresh(refreshToken: string, context: RequestContext): Promise<AuthenticatedSession>;
  logout(refreshToken: string | undefined): Promise<void>;
  me(principal: AuthenticatedPrincipal): Promise<SafeUser>;
  changePassword(
    principal: AuthenticatedPrincipal,
    input: ChangePasswordInput,
    context: RequestContext,
  ): Promise<void>;
}

function normalizePhone(phone: string | undefined): string | null {
  if (phone === undefined) {
    return null;
  }

  const digits = phone.replaceAll(/\D/gu, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Os dados enviados sao invalidos.', {
      fields: [{ field: 'phone', message: 'O telefone deve conter entre 10 e 15 digitos.' }],
    });
  }
  return `+${digits}`;
}

function assertAuthenticatableUser(user: UserRecord): void {
  if (user.status === 'BLOCKED') {
    throw new AppError(403, 'USER_BLOCKED', 'Este usuario esta bloqueado.');
  }
  if (user.status === 'PENDING') {
    throw new AppError(403, 'USER_PENDING', 'Este usuario ainda nao esta ativo.');
  }
  if (user.status !== 'ACTIVE' || user.deletedAt !== null) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha invalidos.');
  }
}

function conflictError(error: IdentityConflictError): AppError {
  return new AppError(409, 'USER_ALREADY_EXISTS', 'Ja existe um usuario com estes dados.', {
    field: error.field,
  });
}

export class DefaultAuthService implements AuthService {
  public constructor(
    private readonly repository: IdentityRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async register(input: RegisterInput): Promise<SafeUser> {
    if (!(await this.repository.isMunicipalityActive(input.municipalityId))) {
      throw new AppError(
        422,
        'INVALID_MUNICIPALITY',
        'O municipio informado e invalido ou inativo.',
      );
    }

    const passwordHash = await hashPassword(input.password);
    try {
      const user = await this.repository.createUser({
        name: input.name,
        email: input.email,
        phone: normalizePhone(input.phone),
        passwordHash,
        municipalityId: input.municipalityId,
        neighborhood: input.neighborhood ?? null,
      });
      return toSafeUser(user);
    } catch (error) {
      if (error instanceof IdentityConflictError) {
        throw conflictError(error);
      }
      throw error;
    }
  }

  public async login(input: LoginInput, context: RequestContext): Promise<AuthenticatedSession> {
    const user = await this.repository.findUserByEmail(input.email);
    if (user === null || !(await verifyPassword(user.passwordHash, input.password))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha invalidos.');
    }
    assertAuthenticatableUser(user);

    const now = this.now();
    const sessionId = randomUUID();
    const tokens = await this.issueTokens(user, sessionId, now);
    await this.repository.createRefreshToken({
      sessionId,
      userId: user.id,
      tokenHash: hashRefreshToken(tokens.refreshToken),
      expiresAt: tokens.refreshTokenExpiresAt,
      ...context,
    });
    await this.repository.touchLastLogin(user.id, now);

    return { ...tokens, user: toSafeUser({ ...user, lastLoginAt: now, updatedAt: now }) };
  }

  public async refresh(
    refreshToken: string,
    context: RequestContext,
  ): Promise<AuthenticatedSession> {
    const now = this.now();
    const tokenRecord = await this.repository.findRefreshTokenByHash(
      hashRefreshToken(refreshToken),
    );
    if (tokenRecord === null) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'O refresh token e invalido.');
    }
    if (tokenRecord.revokedAt !== null) {
      await this.repository.revokeSession(tokenRecord.sessionId, now);
      throw new AppError(
        401,
        'REFRESH_TOKEN_REUSE_DETECTED',
        'Foi detectada reutilizacao de refresh token; a sessao foi revogada.',
      );
    }
    if (tokenRecord.expiresAt.getTime() <= now.getTime()) {
      await this.repository.revokeTokenByHash(tokenRecord.tokenHash, now);
      throw new AppError(401, 'REFRESH_TOKEN_EXPIRED', 'O refresh token expirou.');
    }

    const user = await this.repository.findUserById(tokenRecord.userId);
    if (user === null) {
      await this.repository.revokeSession(tokenRecord.sessionId, now);
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'O refresh token e invalido.');
    }
    assertAuthenticatableUser(user);

    const tokens = await this.issueTokens(user, tokenRecord.sessionId, now);
    const rotated = await this.repository.rotateRefreshToken(
      tokenRecord.id,
      {
        sessionId: tokenRecord.sessionId,
        userId: user.id,
        tokenHash: hashRefreshToken(tokens.refreshToken),
        expiresAt: tokens.refreshTokenExpiresAt,
        ...context,
      },
      now,
    );
    if (!rotated) {
      await this.repository.revokeSession(tokenRecord.sessionId, now);
      throw new AppError(
        401,
        'REFRESH_TOKEN_REUSE_DETECTED',
        'Foi detectada reutilizacao de refresh token; a sessao foi revogada.',
      );
    }

    return { ...tokens, user: toSafeUser(user) };
  }

  public async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken !== undefined && refreshToken !== '') {
      await this.repository.revokeTokenByHash(hashRefreshToken(refreshToken), this.now());
    }
  }

  public async me(principal: AuthenticatedPrincipal): Promise<SafeUser> {
    const user = await this.repository.findUserById(principal.sub);
    if (user === null || user.deletedAt !== null) {
      throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'O token de acesso e invalido.');
    }
    assertAuthenticatableUser(user);
    return toSafeUser(user);
  }

  public async changePassword(
    principal: AuthenticatedPrincipal,
    input: ChangePasswordInput,
    context: RequestContext,
  ): Promise<void> {
    const user = await this.repository.findUserById(principal.sub);
    if (user === null || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new AppError(401, 'INVALID_CURRENT_PASSWORD', 'A senha atual e invalida.');
    }
    const passwordHash = await hashPassword(input.newPassword);
    await this.repository.updatePasswordAndRevokeSessions(
      user.id,
      passwordHash,
      context,
      this.now(),
    );
  }

  private async issueTokens(
    user: UserRecord,
    sessionId: string,
    now: Date,
  ): Promise<SessionTokens> {
    const refreshToken = createOpaqueRefreshToken();
    return {
      accessToken: await signAccessToken(user, sessionId),
      accessTokenExpiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60,
      refreshToken,
      refreshTokenExpiresAt: new Date(
        now.getTime() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      ),
    };
  }
}
