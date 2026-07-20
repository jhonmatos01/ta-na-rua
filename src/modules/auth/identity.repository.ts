import type { QueryResultRow } from 'pg';

import { pool } from '../../database/pool.js';
import type {
  RefreshTokenRecord,
  RequestContext,
  UserRecord,
  UserRole,
  UserStatus,
} from './auth.types.js';

export interface CreateUserData {
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  municipalityId: string;
  neighborhood: string | null;
}

export interface CreateRefreshTokenData extends RequestContext {
  sessionId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface UpdateProfileData {
  name: string;
  phone: string | null;
  municipalityId: string | null;
  neighborhood: string | null;
  avatarUrl: string | null;
}

export interface UserListFilters {
  limit: number;
  offset: number;
  municipalityId?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface UserListResult {
  items: UserRecord[];
  total: number;
}

export class IdentityConflictError extends Error {
  public constructor(public readonly field: 'email' | 'phone') {
    super(`Usuario duplicado: ${field}`);
    this.name = 'IdentityConflictError';
  }
}

export interface IdentityRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(userId: string): Promise<UserRecord | null>;
  isMunicipalityActive(municipalityId: string): Promise<boolean>;
  createUser(data: CreateUserData): Promise<UserRecord>;
  touchLastLogin(userId: string, at: Date): Promise<void>;
  createRefreshToken(data: CreateRefreshTokenData): Promise<void>;
  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  rotateRefreshToken(
    currentTokenId: string,
    replacement: CreateRefreshTokenData,
    at: Date,
  ): Promise<boolean>;
  revokeSession(sessionId: string, at: Date): Promise<void>;
  revokeTokenByHash(tokenHash: string, at: Date): Promise<void>;
  revokeAllUserSessions(userId: string, at: Date): Promise<void>;
  isSessionActive(userId: string, sessionId: string, at: Date): Promise<boolean>;
  updatePasswordAndRevokeSessions(
    userId: string,
    passwordHash: string,
    context: RequestContext,
    at: Date,
  ): Promise<void>;
  updateProfile(
    userId: string,
    data: UpdateProfileData,
    context: RequestContext,
    at: Date,
  ): Promise<UserRecord>;
  deleteUser(userId: string, context: RequestContext, at: Date): Promise<void>;
  listUsers(filters: UserListFilters): Promise<UserListResult>;
  updateUserStatus(
    actorId: string,
    userId: string,
    status: UserStatus,
    context: RequestContext,
    at: Date,
  ): Promise<UserRecord | null>;
  updateUserRole(
    actorId: string,
    userId: string,
    role: UserRole,
    context: RequestContext,
    at: Date,
  ): Promise<UserRecord | null>;
}

interface UserRow extends QueryResultRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: UserRole;
  municipality_id: string | null;
  neighborhood: string | null;
  avatar_url: string | null;
  status: UserStatus;
  email_verified_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface RefreshTokenRow extends QueryResultRow {
  id: string;
  session_id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

const userColumns = `
  id, name, email, phone, password_hash, role, municipality_id, neighborhood,
  avatar_url, status, email_verified_at, last_login_at, created_at, updated_at, deleted_at
`;

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    role: row.role,
    municipalityId: row.municipality_id,
    neighborhood: row.neighborhood,
    avatarUrl: row.avatar_url,
    status: row.status,
    emailVerifiedAt: row.email_verified_at,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapRefreshToken(row: RefreshTokenRow): RefreshTokenRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

function isUniqueViolation(error: unknown): error is { code: string; constraint?: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

async function insertAudit(
  query: (text: string, values: unknown[]) => Promise<unknown>,
  actorId: string | null,
  action: string,
  entityId: string,
  context: RequestContext,
  newData: Record<string, unknown>,
): Promise<void> {
  await query(
    `INSERT INTO audit_logs
      (user_id, action, entity_type, entity_id, new_data, ip_address, user_agent)
     VALUES ($1, $2, 'user', $3, $4::jsonb, $5, $6)`,
    [actorId, action, entityId, JSON.stringify(newData), context.ipAddress, context.userAgent],
  );
}

export class PostgresIdentityRepository implements IdentityRepository {
  public async findUserByEmail(email: string): Promise<UserRecord | null> {
    const result = await pool.query<UserRow>(
      `SELECT ${userColumns} FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );
    return result.rows[0] === undefined ? null : mapUser(result.rows[0]);
  }

  public async findUserById(userId: string): Promise<UserRecord | null> {
    const result = await pool.query<UserRow>(
      `SELECT ${userColumns} FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    return result.rows[0] === undefined ? null : mapUser(result.rows[0]);
  }

  public async isMunicipalityActive(municipalityId: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT 1 FROM municipalities WHERE id = $1 AND active = TRUE',
      [municipalityId],
    );
    return result.rowCount === 1;
  }

  public async createUser(data: CreateUserData): Promise<UserRecord> {
    try {
      const result = await pool.query<UserRow>(
        `INSERT INTO users
          (name, email, phone, password_hash, role, municipality_id, neighborhood, status)
         VALUES ($1, $2, $3, $4, 'CITIZEN', $5, $6, 'ACTIVE')
         RETURNING ${userColumns}`,
        [
          data.name,
          data.email,
          data.phone,
          data.passwordHash,
          data.municipalityId,
          data.neighborhood,
        ],
      );
      return mapUser(result.rows[0] as UserRow);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new IdentityConflictError(
          error.constraint?.includes('phone') === true ? 'phone' : 'email',
        );
      }
      throw error;
    }
  }

  public async touchLastLogin(userId: string, at: Date): Promise<void> {
    await pool.query('UPDATE users SET last_login_at = $2, updated_at = $2 WHERE id = $1', [
      userId,
      at,
    ]);
  }

  public async createRefreshToken(data: CreateRefreshTokenData): Promise<void> {
    await pool.query(
      `INSERT INTO refresh_tokens
        (session_id, user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [data.sessionId, data.userId, data.tokenHash, data.expiresAt, data.ipAddress, data.userAgent],
    );
  }

  public async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const result = await pool.query<RefreshTokenRow>(
      `SELECT id, session_id, user_id, token_hash, expires_at, revoked_at
       FROM refresh_tokens WHERE token_hash = $1 LIMIT 1`,
      [tokenHash],
    );
    return result.rows[0] === undefined ? null : mapRefreshToken(result.rows[0]);
  }

  public async rotateRefreshToken(
    currentTokenId: string,
    replacement: CreateRefreshTokenData,
    at: Date,
  ): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE refresh_tokens
         SET revoked_at = $2, last_used_at = $2
         WHERE id = $1 AND revoked_at IS NULL AND expires_at > $2
         RETURNING id`,
        [currentTokenId, at],
      );
      if (updated.rowCount !== 1) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query(
        `INSERT INTO refresh_tokens
          (session_id, user_id, token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          replacement.sessionId,
          replacement.userId,
          replacement.tokenHash,
          replacement.expiresAt,
          replacement.ipAddress,
          replacement.userAgent,
        ],
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async revokeSession(sessionId: string, at: Date): Promise<void> {
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = $2 WHERE session_id = $1 AND revoked_at IS NULL',
      [sessionId, at],
    );
  }

  public async revokeTokenByHash(tokenHash: string, at: Date): Promise<void> {
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL',
      [tokenHash, at],
    );
  }

  public async revokeAllUserSessions(userId: string, at: Date): Promise<void> {
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL',
      [userId, at],
    );
  }

  public async isSessionActive(userId: string, sessionId: string, at: Date): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM refresh_tokens
       WHERE user_id = $1 AND session_id = $2 AND revoked_at IS NULL AND expires_at > $3
       LIMIT 1`,
      [userId, sessionId, at],
    );
    return result.rowCount === 1;
  }

  public async updatePasswordAndRevokeSessions(
    userId: string,
    passwordHash: string,
    context: RequestContext,
    at: Date,
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE users SET password_hash = $2, updated_at = $3 WHERE id = $1', [
        userId,
        passwordHash,
        at,
      ]);
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL',
        [userId, at],
      );
      await insertAudit(
        client.query.bind(client),
        userId,
        'USER_PASSWORD_CHANGED',
        userId,
        context,
        { sessionsRevoked: true },
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async updateProfile(
    userId: string,
    data: UpdateProfileData,
    context: RequestContext,
    at: Date,
  ): Promise<UserRecord> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<UserRow>(
        `UPDATE users SET name = $2, phone = $3, municipality_id = $4,
          neighborhood = $5, avatar_url = $6, updated_at = $7
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING ${userColumns}`,
        [userId, data.name, data.phone, data.municipalityId, data.neighborhood, data.avatarUrl, at],
      );
      const row = result.rows[0];
      if (row === undefined) {
        throw new Error('Usuario nao encontrado durante atualizacao.');
      }
      await insertAudit(
        client.query.bind(client),
        userId,
        'USER_PROFILE_UPDATED',
        userId,
        context,
        {
          name: data.name,
          municipalityId: data.municipalityId,
        },
      );
      await client.query('COMMIT');
      return mapUser(row);
    } catch (error) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(error)) {
        throw new IdentityConflictError(
          error.constraint?.includes('phone') === true ? 'phone' : 'email',
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  public async deleteUser(userId: string, context: RequestContext, at: Date): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE users SET status = 'DELETED', deleted_at = $2, updated_at = $2 WHERE id = $1`,
        [userId, at],
      );
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL',
        [userId, at],
      );
      await insertAudit(client.query.bind(client), userId, 'USER_DELETED', userId, context, {
        logicalDeletion: true,
        sessionsRevoked: true,
      });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async listUsers(filters: UserListFilters): Promise<UserListResult> {
    const values: unknown[] = [];
    const conditions = ['deleted_at IS NULL'];
    if (filters.municipalityId !== undefined) {
      values.push(filters.municipalityId);
      conditions.push(`municipality_id = $${values.length}`);
    }
    if (filters.role !== undefined) {
      values.push(filters.role);
      conditions.push(`role = $${values.length}`);
    }
    if (filters.status !== undefined) {
      values.push(filters.status);
      conditions.push(`status = $${values.length}`);
    }
    const where = conditions.join(' AND ');
    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM users WHERE ${where}`,
      values,
    );
    values.push(filters.limit, filters.offset);
    const usersResult = await pool.query<UserRow>(
      `SELECT ${userColumns} FROM users WHERE ${where}
       ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return {
      items: usersResult.rows.map(mapUser),
      total: Number(countResult.rows[0]?.total ?? 0),
    };
  }

  public async updateUserStatus(
    actorId: string,
    userId: string,
    status: UserStatus,
    context: RequestContext,
    at: Date,
  ): Promise<UserRecord | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<UserRow>(
        `UPDATE users SET status = $2, updated_at = $3 WHERE id = $1 AND deleted_at IS NULL
         RETURNING ${userColumns}`,
        [userId, status, at],
      );
      const row = result.rows[0];
      if (row !== undefined) {
        if (status !== 'ACTIVE') {
          await client.query(
            'UPDATE refresh_tokens SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL',
            [userId, at],
          );
        }
        await insertAudit(
          client.query.bind(client),
          actorId,
          'ADMIN_USER_STATUS_CHANGED',
          userId,
          context,
          {
            status,
          },
        );
      }
      await client.query('COMMIT');
      return row === undefined ? null : mapUser(row);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async updateUserRole(
    actorId: string,
    userId: string,
    role: UserRole,
    context: RequestContext,
    at: Date,
  ): Promise<UserRecord | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<UserRow>(
        `UPDATE users SET role = $2, updated_at = $3 WHERE id = $1 AND deleted_at IS NULL
         RETURNING ${userColumns}`,
        [userId, role, at],
      );
      const row = result.rows[0];
      if (row !== undefined) {
        await client.query(
          'UPDATE refresh_tokens SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL',
          [userId, at],
        );
        await insertAudit(
          client.query.bind(client),
          actorId,
          'ADMIN_USER_ROLE_CHANGED',
          userId,
          context,
          {
            role,
            sessionsRevoked: true,
          },
        );
      }
      await client.query('COMMIT');
      return row === undefined ? null : mapUser(row);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
