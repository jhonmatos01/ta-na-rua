import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  aiAnalyses,
  aiAnalysisTypeValues,
  auditLogs,
  categories,
  departments,
  imageTypeValues,
  moderationStatusValues,
  municipalities,
  neighborhoods,
  notificationTypeValues,
  notifications,
  occurrenceConfirmations,
  occurrenceImages,
  occurrenceReports,
  occurrenceStatusHistory,
  occurrences,
  occurrenceStatusValues,
  outboxEvents,
  outboxEventStatusValues,
  protocolCounters,
  refreshTokens,
  repairEvaluations,
  reportSourceValues,
  riskLevelValues,
  userRoleValues,
  users,
  userStatusValues,
  webhookEvents,
  webhookEventStatusValues,
} from '../../src/database/schema/index.js';
import { assertDevelopmentSeedAllowed } from '../../src/database/seed-policy.js';

const tables = [
  aiAnalyses,
  auditLogs,
  categories,
  departments,
  municipalities,
  neighborhoods,
  notifications,
  occurrenceConfirmations,
  occurrenceImages,
  occurrenceReports,
  occurrenceStatusHistory,
  occurrences,
  outboxEvents,
  protocolCounters,
  refreshTokens,
  repairEvaluations,
  users,
  webhookEvents,
];

describe('schema da Fase 1', () => {
  it('exporta todas as tabelas definitivas previstas no PRD', () => {
    expect(tables.map((table) => getTableName(table)).sort()).toEqual([
      'ai_analyses',
      'audit_logs',
      'categories',
      'departments',
      'municipalities',
      'neighborhoods',
      'notifications',
      'occurrence_confirmations',
      'occurrence_images',
      'occurrence_reports',
      'occurrence_status_history',
      'occurrences',
      'outbox_events',
      'protocol_counters',
      'refresh_tokens',
      'repair_evaluations',
      'users',
      'webhook_events',
    ]);
  });

  it('mantem os valores de enum definidos pelo PRD e as extensoes documentadas', () => {
    expect(userRoleValues).toEqual(['CITIZEN', 'CITY_OPERATOR', 'MODERATOR', 'ADMIN']);
    expect(userStatusValues).toContain('BLOCKED');
    expect(occurrenceStatusValues).toHaveLength(12);
    expect(riskLevelValues).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    expect(reportSourceValues).toContain('WHATSAPP');
    expect(imageTypeValues).toContain('AFTER_REPAIR');
    expect(moderationStatusValues).toContain('FLAGGED');
    expect(aiAnalysisTypeValues).toContain('DUPLICATE_DETECTION');
    expect(notificationTypeValues).toContain('STATUS_CHANGED');
    expect(webhookEventStatusValues).toContain('IGNORED');
    expect(outboxEventStatusValues).toEqual(['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED']);
  });

  it('bloqueia o seed de desenvolvimento em producao', () => {
    expect(() => assertDevelopmentSeedAllowed('production')).toThrow(/producao/);
    expect(() => assertDevelopmentSeedAllowed('development')).not.toThrow();
  });
});
