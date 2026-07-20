import type { userRoleValues, userStatusValues } from '../../database/schema/enums.js';

export type UserRole = (typeof userRoleValues)[number];
export type UserStatus = (typeof userStatusValues)[number];

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  role: UserRole;
  municipalityId: string | null;
  neighborhood: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type SafeUser = Omit<UserRecord, 'passwordHash'>;

export interface AuthenticatedPrincipal {
  sub: string;
  role: UserRole;
  municipalityId: string | null;
  sessionId: string;
}

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface AuthenticatedSession extends SessionTokens {
  user: SafeUser;
}

export interface RefreshTokenRecord {
  id: string;
  sessionId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export function toSafeUser(user: UserRecord): SafeUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}
