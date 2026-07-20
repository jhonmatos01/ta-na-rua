import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { notificationTypeEnum, outboxEventStatusEnum, webhookEventStatusEnum } from './enums.js';
import { users } from './users.js';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 180 }).notNull(),
    message: text('message').notNull(),
    entityType: varchar('entity_type', { length: 100 }),
    entityId: uuid('entity_id'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('notifications_user_read_created_idx').on(table.userId, table.readAt, table.createdAt),
    index('notifications_entity_idx').on(table.entityType, table.entityId),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    action: varchar('action', { length: 150 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: uuid('entity_id'),
    previousData: jsonb('previous_data').$type<Record<string, unknown>>(),
    newData: jsonb('new_data').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_user_created_idx').on(table.userId, table.createdAt),
    index('audit_logs_entity_created_idx').on(table.entityType, table.entityId, table.createdAt),
    index('audit_logs_action_created_idx').on(table.action, table.createdAt),
  ],
);

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: varchar('provider', { length: 100 }).notNull(),
    externalEventId: varchar('external_event_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 150 }).notNull(),
    payloadHash: varchar('payload_hash', { length: 255 }).notNull(),
    status: webhookEventStatusEnum('status').default('RECEIVED').notNull(),
    responseCode: integer('response_code'),
    errorMessage: text('error_message'),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('webhook_events_provider_external_uidx').on(table.provider, table.externalEventId),
    index('webhook_events_status_received_idx').on(table.status, table.receivedAt),
    check(
      'webhook_events_response_code_chk',
      sql`${table.responseCode} IS NULL OR ${table.responseCode} BETWEEN 100 AND 599`,
    ),
  ],
);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventType: varchar('event_type', { length: 150 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: outboxEventStatusEnum('status').default('PENDING').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    availableAt: timestamp('available_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('outbox_events_status_available_idx').on(table.status, table.availableAt),
    index('outbox_events_entity_idx').on(table.entityType, table.entityId),
    check('outbox_events_attempts_chk', sql`${table.attempts} >= 0`),
  ],
);

export const protocolCounters = pgTable(
  'protocol_counters',
  {
    year: integer('year').notNull(),
    lastValue: bigint('last_value', { mode: 'number' }).default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ name: 'protocol_counters_pkey', columns: [table.year] }),
    check('protocol_counters_year_chk', sql`${table.year} BETWEEN 2000 AND 9999`),
    check('protocol_counters_last_value_chk', sql`${table.lastValue} >= 0`),
  ],
);
