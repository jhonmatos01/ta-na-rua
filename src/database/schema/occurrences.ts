import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { categories, departments, municipalities, neighborhoods } from './core.js';
import { geographyPoint } from './custom-types.js';
import {
  aiAnalysisTypeEnum,
  imageTypeEnum,
  moderationStatusEnum,
  occurrenceStatusEnum,
  reportSourceEnum,
  riskLevelEnum,
} from './enums.js';
import { users } from './users.js';

export const occurrences = pgTable(
  'occurrences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    protocol: varchar('protocol', { length: 32 }).notNull(),
    title: varchar('title', { length: 150 }).notNull(),
    description: text('description'),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    municipalityId: uuid('municipality_id')
      .notNull()
      .references(() => municipalities.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    neighborhoodId: uuid('neighborhood_id').references(() => neighborhoods.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    assignedDepartmentId: uuid('assigned_department_id').references(() => departments.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    assignedBy: uuid('assigned_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    status: occurrenceStatusEnum('status').default('PENDING_REVIEW').notNull(),
    severity: integer('severity'),
    priorityScore: numeric('priority_score', { precision: 5, scale: 2 }).default('0').notNull(),
    riskLevel: riskLevelEnum('risk_level'),
    address: varchar('address', { length: 500 }),
    neighborhoodText: varchar('neighborhood_text', { length: 150 }),
    latitude: numeric('latitude', { precision: 9, scale: 6 }).notNull(),
    longitude: numeric('longitude', { precision: 9, scale: 6 }).notNull(),
    location: geographyPoint('location').notNull(),
    locationAccuracy: numeric('location_accuracy', { precision: 10, scale: 2 }),
    anonymousPublication: boolean('anonymous_publication').default(false).notNull(),
    confirmationCount: integer('confirmation_count').default(0).notNull(),
    duplicateOfOccurrenceId: uuid('duplicate_of_occurrence_id').references(
      (): AnyPgColumn => occurrences.id,
      { onDelete: 'set null', onUpdate: 'cascade' },
    ),
    expectedResolutionAt: timestamp('expected_resolution_at', { withTimezone: true }),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    resolutionDescription: text('resolution_description'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: uuid('closed_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    firstReportedAt: timestamp('first_reported_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('occurrences_protocol_uidx').on(table.protocol),
    index('occurrences_municipality_idx').on(table.municipalityId),
    index('occurrences_neighborhood_idx').on(table.neighborhoodId),
    index('occurrences_category_idx').on(table.categoryId),
    index('occurrences_status_idx').on(table.status),
    index('occurrences_created_at_idx').on(table.createdAt),
    index('occurrences_confirmation_count_idx').on(table.confirmationCount),
    index('occurrences_dashboard_idx').on(
      table.municipalityId,
      table.status,
      table.categoryId,
      table.createdAt,
    ),
    index('occurrences_municipality_created_idx').on(table.municipalityId, table.createdAt),
    index('occurrences_priority_idx').on(table.municipalityId, table.priorityScore),
    index('occurrences_resolution_idx').on(table.municipalityId, table.resolvedAt),
    index('occurrences_location_gist_idx').using('gist', table.location),
    check('occurrences_latitude_chk', sql`${table.latitude} BETWEEN -90 AND 90`),
    check('occurrences_longitude_chk', sql`${table.longitude} BETWEEN -180 AND 180`),
    check(
      'occurrences_severity_chk',
      sql`${table.severity} IS NULL OR ${table.severity} BETWEEN 1 AND 5`,
    ),
    check('occurrences_priority_score_chk', sql`${table.priorityScore} BETWEEN 0 AND 100`),
    check('occurrences_confirmation_count_chk', sql`${table.confirmationCount} >= 0`),
    check(
      'occurrences_duplicate_self_chk',
      sql`${table.duplicateOfOccurrenceId} IS NULL OR ${table.duplicateOfOccurrenceId} <> ${table.id}`,
    ),
    check(
      'occurrences_description_length_chk',
      sql`${table.description} IS NULL OR char_length(${table.description}) <= 2000`,
    ),
  ],
);

export const occurrenceReports = pgTable(
  'occurrence_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    occurrenceId: uuid('occurrence_id')
      .notNull()
      .references(() => occurrences.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    reportedBy: uuid('reported_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    originalDescription: text('original_description').notNull(),
    latitude: numeric('latitude', { precision: 9, scale: 6 }).notNull(),
    longitude: numeric('longitude', { precision: 9, scale: 6 }).notNull(),
    location: geographyPoint('location').notNull(),
    reportedAt: timestamp('reported_at', { withTimezone: true }).defaultNow().notNull(),
    source: reportSourceEnum('source').default('WEB_APP').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('occurrence_reports_occurrence_idx').on(table.occurrenceId),
    index('occurrence_reports_reported_by_idx').on(table.reportedBy),
    index('occurrence_reports_reported_at_idx').on(table.reportedAt),
    index('occurrence_reports_location_gist_idx').using('gist', table.location),
    check('occurrence_reports_latitude_chk', sql`${table.latitude} BETWEEN -90 AND 90`),
    check('occurrence_reports_longitude_chk', sql`${table.longitude} BETWEEN -180 AND 180`),
    check(
      'occurrence_reports_description_length_chk',
      sql`char_length(${table.originalDescription}) <= 2000`,
    ),
  ],
);

export const occurrenceImages = pgTable(
  'occurrence_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    occurrenceId: uuid('occurrence_id')
      .notNull()
      .references(() => occurrences.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    reportId: uuid('report_id').references(() => occurrenceReports.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    fileUrl: varchar('file_url', { length: 2048 }).notNull(),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    publicStorageKey: varchar('public_storage_key', { length: 512 }),
    sanitizationMode: varchar('sanitization_mode', { length: 20 }),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    fileSize: integer('file_size').notNull(),
    imageType: imageTypeEnum('image_type').default('INITIAL').notNull(),
    moderationStatus: moderationStatusEnum('moderation_status').default('PENDING').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('occurrence_images_storage_key_uidx').on(table.storageKey),
    index('occurrence_images_occurrence_idx').on(table.occurrenceId),
    index('occurrence_images_report_idx').on(table.reportId),
    index('occurrence_images_moderation_idx').on(table.moderationStatus, table.createdAt),
    check('occurrence_images_file_size_chk', sql`${table.fileSize} > 0`),
  ],
);

export const occurrenceConfirmations = pgTable(
  'occurrence_confirmations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    occurrenceId: uuid('occurrence_id')
      .notNull()
      .references(() => occurrences.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    directlyAffected: boolean('directly_affected').default(false).notNull(),
    problemWorsened: boolean('problem_worsened').default(false).notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('occurrence_confirmations_occurrence_user_uidx').on(
      table.occurrenceId,
      table.userId,
    ),
    index('occurrence_confirmations_user_idx').on(table.userId),
    check(
      'occurrence_confirmations_comment_length_chk',
      sql`${table.comment} IS NULL OR char_length(${table.comment}) <= 500`,
    ),
  ],
);

export const occurrenceStatusHistory = pgTable(
  'occurrence_status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    occurrenceId: uuid('occurrence_id')
      .notNull()
      .references(() => occurrences.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    previousStatus: occurrenceStatusEnum('previous_status'),
    newStatus: occurrenceStatusEnum('new_status').notNull(),
    changedBy: uuid('changed_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    reason: text('reason'),
    publicMessage: text('public_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('occurrence_status_history_occurrence_created_idx').on(
      table.occurrenceId,
      table.createdAt,
    ),
    index('occurrence_status_history_changed_by_idx').on(table.changedBy),
  ],
);

export const repairEvaluations = pgTable(
  'repair_evaluations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    occurrenceId: uuid('occurrence_id')
      .notNull()
      .references(() => occurrences.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    rating: integer('rating').notNull(),
    problemResolved: boolean('problem_resolved').notNull(),
    serviceQuality: integer('service_quality'),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('repair_evaluations_occurrence_user_uidx').on(table.occurrenceId, table.userId),
    index('repair_evaluations_user_idx').on(table.userId),
    check('repair_evaluations_rating_chk', sql`${table.rating} BETWEEN 1 AND 5`),
    check(
      'repair_evaluations_service_quality_chk',
      sql`${table.serviceQuality} IS NULL OR ${table.serviceQuality} BETWEEN 1 AND 5`,
    ),
  ],
);

export const aiAnalyses = pgTable(
  'ai_analyses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    occurrenceId: uuid('occurrence_id').references(() => occurrences.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    reportId: uuid('report_id').references(() => occurrenceReports.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    analysisType: aiAnalysisTypeEnum('analysis_type').notNull(),
    modelName: varchar('model_name', { length: 150 }).notNull(),
    suggestedCategory: varchar('suggested_category', { length: 100 }),
    suggestedSubcategory: varchar('suggested_subcategory', { length: 100 }),
    suggestedSeverity: integer('suggested_severity'),
    suggestedRisk: varchar('suggested_risk', { length: 20 }),
    confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
    summary: text('summary'),
    possibleDuplicates: jsonb('possible_duplicates').$type<unknown[]>(),
    rawResult: jsonb('raw_result').$type<Record<string, unknown>>().notNull(),
    requiresHumanReview: boolean('requires_human_review').default(false).notNull(),
    reviewedBy: uuid('reviewed_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('ai_analyses_occurrence_idx').on(table.occurrenceId),
    index('ai_analyses_report_idx').on(table.reportId),
    index('ai_analyses_review_idx').on(table.requiresHumanReview, table.createdAt),
    check(
      'ai_analyses_target_chk',
      sql`${table.occurrenceId} IS NOT NULL OR ${table.reportId} IS NOT NULL`,
    ),
    check('ai_analyses_confidence_chk', sql`${table.confidence} BETWEEN 0 AND 1`),
    check(
      'ai_analyses_severity_chk',
      sql`${table.suggestedSeverity} IS NULL OR ${table.suggestedSeverity} BETWEEN 1 AND 5`,
    ),
  ],
);
