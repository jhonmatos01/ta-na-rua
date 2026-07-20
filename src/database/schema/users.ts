import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { municipalities } from './core.js';
import { userRoleEnum, userStatusEnum } from './enums.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    email: varchar('email', { length: 254 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: userRoleEnum('role').default('CITIZEN').notNull(),
    municipalityId: uuid('municipality_id').references(() => municipalities.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    neighborhood: varchar('neighborhood', { length: 150 }),
    avatarUrl: varchar('avatar_url', { length: 2048 }),
    status: userStatusEnum('status').default('PENDING').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('users_email_uidx').on(table.email),
    uniqueIndex('users_phone_uidx').on(table.phone),
    index('users_municipality_role_status_idx').on(table.municipalityId, table.role, table.status),
    index('users_deleted_at_idx').on(table.deletedAt),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 1024 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('refresh_tokens_token_hash_uidx').on(table.tokenHash),
    index('refresh_tokens_user_idx').on(table.userId),
    index('refresh_tokens_session_idx').on(table.sessionId),
    index('refresh_tokens_expires_revoked_idx').on(table.expiresAt, table.revokedAt),
  ],
);
