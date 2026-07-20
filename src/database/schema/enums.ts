import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleValues = ['CITIZEN', 'CITY_OPERATOR', 'MODERATOR', 'ADMIN'] as const;
export const userRoleEnum = pgEnum('user_role', userRoleValues);

export const userStatusValues = ['ACTIVE', 'PENDING', 'BLOCKED', 'DELETED'] as const;
export const userStatusEnum = pgEnum('user_status', userStatusValues);

export const occurrenceStatusValues = [
  'PENDING_REVIEW',
  'PUBLISHED',
  'FORWARDED',
  'ACKNOWLEDGED',
  'UNDER_ANALYSIS',
  'SCHEDULED',
  'IN_PROGRESS',
  'RESOLVED',
  'CONTESTED',
  'CLOSED',
  'REJECTED',
  'DUPLICATE',
] as const;
export const occurrenceStatusEnum = pgEnum('occurrence_status', occurrenceStatusValues);

export const riskLevelValues = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const riskLevelEnum = pgEnum('risk_level', riskLevelValues);

export const reportSourceValues = ['WEB_APP', 'TELEGRAM', 'WHATSAPP', 'ADMIN', 'API'] as const;
export const reportSourceEnum = pgEnum('report_source', reportSourceValues);

export const imageTypeValues = [
  'INITIAL',
  'UPDATE',
  'BEFORE_REPAIR',
  'DURING_REPAIR',
  'AFTER_REPAIR',
  'EVALUATION',
] as const;
export const imageTypeEnum = pgEnum('image_type', imageTypeValues);

export const moderationStatusValues = ['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED'] as const;
export const moderationStatusEnum = pgEnum('moderation_status', moderationStatusValues);

export const aiAnalysisTypeValues = [
  'CLASSIFICATION',
  'DUPLICATE_DETECTION',
  'CONTENT_MODERATION',
  'REASSESSMENT',
] as const;
export const aiAnalysisTypeEnum = pgEnum('ai_analysis_type', aiAnalysisTypeValues);

export const notificationTypeValues = [
  'OCCURRENCE_CREATED',
  'STATUS_CHANGED',
  'OCCURRENCE_CONFIRMED',
  'OCCURRENCE_DUPLICATE',
  'REPAIR_EVALUATION_REQUESTED',
  'SYSTEM',
] as const;
export const notificationTypeEnum = pgEnum('notification_type', notificationTypeValues);

export const webhookEventStatusValues = [
  'RECEIVED',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
  'IGNORED',
] as const;
export const webhookEventStatusEnum = pgEnum('webhook_event_status', webhookEventStatusValues);

export const outboxEventStatusValues = ['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'] as const;
export const outboxEventStatusEnum = pgEnum('outbox_event_status', outboxEventStatusValues);
