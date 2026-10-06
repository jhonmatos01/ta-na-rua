import { sql } from 'drizzle-orm';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { hashPassword, hashRefreshToken } from '../modules/auth/auth.security.js';
import {
  aiAnalyses,
  auditLogs,
  categories,
  departments,
  municipalities,
  neighborhoods,
  notifications,
  outboxEvents,
  occurrenceConfirmations,
  occurrenceImages,
  occurrenceReports,
  occurrences,
  occurrenceStatusHistory,
  protocolCounters,
  repairEvaluations,
  refreshTokens,
  users,
  webhookEvents,
} from './schema/index.js';
import { checkDatabaseHealth } from './health.js';
import { closeDatabase, database } from './pool.js';
import { assertDevelopmentSeedAllowed } from './seed-policy.js';

const ids = {
  municipalities: {
    salvador: '10000000-0000-4000-8000-000000000001',
    feiraDeSantana: '10000000-0000-4000-8000-000000000002',
  },
  neighborhoods: {
    pituba: '20000000-0000-4000-8000-000000000001',
    itapua: '20000000-0000-4000-8000-000000000002',
    feiraCentro: '20000000-0000-4000-8000-000000000003',
  },
  categories: {
    pothole: '30000000-0000-4000-8000-000000000001',
    publicLighting: '30000000-0000-4000-8000-000000000002',
    waterLeak: '30000000-0000-4000-8000-000000000003',
    sewage: '30000000-0000-4000-8000-000000000004',
    garbage: '30000000-0000-4000-8000-000000000005',
    sidewalkDamage: '30000000-0000-4000-8000-000000000006',
    flooding: '30000000-0000-4000-8000-000000000007',
    fallenTree: '30000000-0000-4000-8000-000000000008',
    trafficSign: '30000000-0000-4000-8000-000000000009',
    trafficLight: '30000000-0000-4000-8000-000000000010',
    other: '30000000-0000-4000-8000-000000000011',
  },
  departments: {
    maintenance: '40000000-0000-4000-8000-000000000001',
    lighting: '40000000-0000-4000-8000-000000000002',
    feiraMaintenance: '40000000-0000-4000-8000-000000000003',
  },
  users: {
    ana: '50000000-0000-4000-8000-000000000001',
    bruno: '50000000-0000-4000-8000-000000000002',
    carla: '50000000-0000-4000-8000-000000000003',
    davi: '50000000-0000-4000-8000-000000000004',
    marina: '50000000-0000-4000-8000-000000000005',
    adriano: '50000000-0000-4000-8000-000000000006',
    bia: '50000000-0000-4000-8000-000000000007',
  },
  refreshTokens: {
    revoked: '51000000-0000-4000-8000-000000000001',
    revokedSession: '51100000-0000-4000-8000-000000000001',
  },
  occurrences: {
    pothole: '60000000-0000-4000-8000-000000000001',
    lighting: '60000000-0000-4000-8000-000000000002',
  },
  reports: {
    pothole: '70000000-0000-4000-8000-000000000001',
    lighting: '70000000-0000-4000-8000-000000000002',
  },
  images: {
    pothole: '71000000-0000-4000-8000-000000000001',
    lighting: '71000000-0000-4000-8000-000000000002',
  },
  confirmations: {
    pothole: '72000000-0000-4000-8000-000000000001',
  },
  histories: {
    potholePublished: '73000000-0000-4000-8000-000000000001',
    lightingCreated: '73000000-0000-4000-8000-000000000002',
    lightingResolved: '73000000-0000-4000-8000-000000000003',
  },
  evaluations: {
    lighting: '74000000-0000-4000-8000-000000000001',
  },
  aiAnalyses: {
    potholeClassification: '74500000-0000-4000-8000-000000000001',
  },
  notifications: {
    pothole: '75000000-0000-4000-8000-000000000001',
    lighting: '75000000-0000-4000-8000-000000000002',
  },
  auditLogs: {
    pothole: '76000000-0000-4000-8000-000000000001',
  },
  webhookEvents: {
    telegramReport: '77000000-0000-4000-8000-000000000001',
  },
  outboxEvents: {
    telegramReport: '78000000-0000-4000-8000-000000000001',
  },
} as const;

const categorySeed = [
  [ids.categories.pothole, 'POTHOLE', 'Buraco na via', 'buraco-na-via'],
  [ids.categories.publicLighting, 'PUBLIC_LIGHTING', 'Iluminacao publica', 'iluminacao-publica'],
  [ids.categories.waterLeak, 'WATER_LEAK', 'Vazamento de agua', 'vazamento-de-agua'],
  [ids.categories.sewage, 'SEWAGE', 'Esgoto', 'esgoto'],
  [ids.categories.garbage, 'GARBAGE', 'Lixo', 'lixo'],
  [ids.categories.sidewalkDamage, 'SIDEWALK_DAMAGE', 'Calcada danificada', 'calcada-danificada'],
  [ids.categories.flooding, 'FLOODING', 'Alagamento', 'alagamento'],
  [ids.categories.fallenTree, 'FALLEN_TREE', 'Arvore caida', 'arvore-caida'],
  [ids.categories.trafficSign, 'TRAFFIC_SIGN', 'Sinalizacao', 'sinalizacao'],
  [ids.categories.trafficLight, 'TRAFFIC_LIGHT', 'Semaforo', 'semaforo'],
  [ids.categories.other, 'OTHER', 'Outro', 'outro'],
] as const;

function point(longitude: string, latitude: string) {
  return sql`ST_SetSRID(ST_MakePoint(${longitude}::double precision, ${latitude}::double precision), 4326)::geography`;
}

const demoImageDefinitions = [
  {
    sourceName: 'pothole-before-repair.png',
    storageKey: 'fixtures/phase-1/pothole-before-repair.png',
  },
  {
    sourceName: 'streetlight-after-repair.png',
    storageKey: 'fixtures/phase-1/streetlight-after-repair.png',
  },
] as const;

async function prepareDemoImageFiles() {
  if (env.STORAGE_PROVIDER !== 'local') {
    throw new Error(
      'O seed com imagens de demonstracao exige STORAGE_PROVIDER=local. O seed permanece bloqueado em producao.',
    );
  }

  const sourceDirectory = path.resolve('fixtures/demo-occurrences');
  const storageDirectory = path.resolve(env.STORAGE_LOCAL_DIRECTORY);
  const publicBaseUrl = env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/u, '');

  async function prepareImage({ sourceName, storageKey }: (typeof demoImageDefinitions)[number]) {
    const source = path.resolve(sourceDirectory, sourceName);
    const target = path.resolve(storageDirectory, ...storageKey.split('/'));
    if (!target.startsWith(`${storageDirectory}${path.sep}`)) {
      throw new Error('A chave da imagem de demonstracao saiu do diretorio de armazenamento.');
    }

    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
    const metadata = await stat(source);

    return {
      fileUrl: `${publicBaseUrl}/${storageKey}`,
      storageKey,
      mimeType: 'image/png' as const,
      fileSize: metadata.size,
    };
  }

  return Promise.all([
    prepareImage(demoImageDefinitions[0]),
    prepareImage(demoImageDefinitions[1]),
  ]);
}

async function runSeed(): Promise<void> {
  assertDevelopmentSeedAllowed(env.NODE_ENV);

  const health = await checkDatabaseHealth();
  const [potholeImage, lightingImage] = await prepareDemoImageFiles();
  const [citizenHash, operatorHash, moderatorHash, adminHash, blockedHash] = await Promise.all([
    hashPassword('Cidada123!Fase2'),
    hashPassword('Operador123!Fase2'),
    hashPassword('Moderador123!Fase2'),
    hashPassword('Admin123!Fase2'),
    hashPassword('Bloqueada123!Fase2'),
  ]);

  await database.transaction(async (transaction) => {
    await transaction
      .insert(municipalities)
      .values([
        {
          id: ids.municipalities.salvador,
          name: 'Salvador',
          state: 'BA',
          ibgeCode: '2927408',
          latitude: '-12.977749',
          longitude: '-38.501629',
        },
        {
          id: ids.municipalities.feiraDeSantana,
          name: 'Feira de Santana',
          state: 'BA',
          ibgeCode: '2910800',
          latitude: '-12.266429',
          longitude: '-38.966305',
        },
      ])
      .onConflictDoNothing();

    await transaction
      .insert(neighborhoods)
      .values([
        {
          id: ids.neighborhoods.pituba,
          municipalityId: ids.municipalities.salvador,
          name: 'Pituba',
          slug: 'pituba',
        },
        {
          id: ids.neighborhoods.itapua,
          municipalityId: ids.municipalities.salvador,
          name: 'Itapua',
          slug: 'itapua',
        },
        {
          id: ids.neighborhoods.feiraCentro,
          municipalityId: ids.municipalities.feiraDeSantana,
          name: 'Centro',
          slug: 'centro',
        },
      ])
      .onConflictDoNothing();

    await transaction
      .insert(categories)
      .values(
        categorySeed.map(([id, code, name, slug]) => ({
          id,
          code,
          name,
          slug,
          description: `Categoria inicial ${name} para dados de demonstracao.`,
        })),
      )
      .onConflictDoNothing();

    await transaction
      .insert(departments)
      .values([
        {
          id: ids.departments.maintenance,
          municipalityId: ids.municipalities.salvador,
          name: 'Conservacao urbana',
          description: 'Setor ficticio para demonstracao de manutencao viaria.',
        },
        {
          id: ids.departments.lighting,
          municipalityId: ids.municipalities.salvador,
          name: 'Iluminacao publica',
          description: 'Setor ficticio para demonstracao de atendimento de iluminacao.',
        },
        {
          id: ids.departments.feiraMaintenance,
          municipalityId: ids.municipalities.feiraDeSantana,
          name: 'Manutencao urbana',
          description: 'Setor ficticio do segundo municipio.',
        },
      ])
      .onConflictDoNothing();

    await transaction
      .insert(users)
      .values([
        {
          id: ids.users.ana,
          name: 'Ana Cidada',
          email: 'ana.cidada@example.test',
          phone: '+5571999990001',
          passwordHash: citizenHash,
          role: 'CITIZEN',
          municipalityId: ids.municipalities.salvador,
          neighborhood: 'Pituba',
          status: 'ACTIVE',
        },
        {
          id: ids.users.bruno,
          name: 'Bruno Operador',
          email: 'bruno.operador@example.test',
          phone: '+5571999990002',
          passwordHash: operatorHash,
          role: 'CITY_OPERATOR',
          municipalityId: ids.municipalities.salvador,
          neighborhood: 'Itapua',
          status: 'ACTIVE',
        },
        {
          id: ids.users.carla,
          name: 'Carla Cidada',
          email: 'carla.cidada@example.test',
          phone: '+5575999990003',
          passwordHash: citizenHash,
          role: 'CITIZEN',
          municipalityId: ids.municipalities.feiraDeSantana,
          neighborhood: 'Centro',
          status: 'ACTIVE',
        },
        {
          id: ids.users.davi,
          name: 'Davi Operador Feira',
          email: 'davi.operador@example.test',
          phone: '+5575999990004',
          passwordHash: operatorHash,
          role: 'CITY_OPERATOR',
          municipalityId: ids.municipalities.feiraDeSantana,
          neighborhood: 'Centro',
          status: 'ACTIVE',
        },
        {
          id: ids.users.marina,
          name: 'Marina Moderadora',
          email: 'marina.moderadora@example.test',
          phone: '+5571999990005',
          passwordHash: moderatorHash,
          role: 'MODERATOR',
          municipalityId: ids.municipalities.salvador,
          status: 'ACTIVE',
        },
        {
          id: ids.users.adriano,
          name: 'Adriano Administrador',
          email: 'adriano.admin@example.test',
          phone: '+5571999990006',
          passwordHash: adminHash,
          role: 'ADMIN',
          municipalityId: ids.municipalities.salvador,
          status: 'ACTIVE',
        },
        {
          id: ids.users.bia,
          name: 'Bia Bloqueada',
          email: 'bia.bloqueada@example.test',
          phone: '+5571999990007',
          passwordHash: blockedHash,
          role: 'CITIZEN',
          municipalityId: ids.municipalities.salvador,
          status: 'BLOCKED',
        },
      ])
      .onConflictDoUpdate({
        target: users.id,
        set: {
          passwordHash: sql`excluded.password_hash`,
          role: sql`excluded.role`,
          status: sql`excluded.status`,
          updatedAt: new Date(),
        },
      });

    await transaction
      .insert(refreshTokens)
      .values({
        id: ids.refreshTokens.revoked,
        sessionId: ids.refreshTokens.revokedSession,
        userId: ids.users.ana,
        tokenHash: hashRefreshToken('fixture-revoked-token-never-exposed-by-the-api'),
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        revokedAt: new Date('2026-07-18T12:00:00.000Z'),
        lastUsedAt: new Date('2026-07-18T12:00:00.000Z'),
        ipAddress: '127.0.0.1',
        userAgent: 'phase-2-seed',
      })
      .onConflictDoUpdate({
        target: refreshTokens.id,
        set: {
          revokedAt: new Date('2026-07-18T12:00:00.000Z'),
          lastUsedAt: new Date('2026-07-18T12:00:00.000Z'),
        },
      });

    await transaction
      .insert(occurrences)
      .values([
        {
          id: ids.occurrences.pothole,
          protocol: 'TNR-2026-000001',
          title: 'Buraco em via de demonstracao',
          description: 'Ocorrencia ficticia criada pelo seed da Fase 1.',
          categoryId: ids.categories.pothole,
          municipalityId: ids.municipalities.salvador,
          neighborhoodId: ids.neighborhoods.pituba,
          createdBy: ids.users.ana,
          status: 'PUBLISHED',
          severity: 3,
          priorityScore: '42.50',
          riskLevel: 'MEDIUM',
          address: 'Endereco removido das respostas publicas',
          neighborhoodText: 'Pituba',
          latitude: '-12.994100',
          longitude: '-38.459000',
          location: point('-38.459000', '-12.994100'),
          locationAccuracy: '8.00',
          confirmationCount: 1,
          firstReportedAt: new Date('2026-07-15T10:00:00.000Z'),
          createdAt: new Date('2026-07-15T10:00:00.000Z'),
          updatedAt: new Date('2026-07-18T12:00:00.000Z'),
        },
        {
          id: ids.occurrences.lighting,
          protocol: 'TNR-2026-000002',
          title: 'Poste apagado resolvido em demonstracao',
          description: 'Registro ficticio resolvido para validar historico e avaliacao.',
          categoryId: ids.categories.publicLighting,
          municipalityId: ids.municipalities.salvador,
          neighborhoodId: ids.neighborhoods.itapua,
          createdBy: ids.users.ana,
          assignedDepartmentId: ids.departments.lighting,
          assignedBy: ids.users.bruno,
          assignedAt: new Date('2026-07-15T12:00:00.000Z'),
          status: 'RESOLVED',
          severity: 2,
          priorityScore: '24.00',
          riskLevel: 'LOW',
          neighborhoodText: 'Itapua',
          latitude: '-12.947900',
          longitude: '-38.363400',
          location: point('-38.363400', '-12.947900'),
          resolutionDescription: 'Lampada substituida em cenario ficticio.',
          resolvedAt: new Date('2026-07-16T15:00:00.000Z'),
          resolvedBy: ids.users.bruno,
          confirmationCount: 0,
          firstReportedAt: new Date('2026-07-15T09:00:00.000Z'),
          createdAt: new Date('2026-07-15T09:00:00.000Z'),
          updatedAt: new Date('2026-07-16T15:00:00.000Z'),
        },
      ])
      .onConflictDoUpdate({
        target: occurrences.id,
        set: {
          firstReportedAt: sql`excluded.first_reported_at`,
          createdAt: sql`excluded.created_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

    await transaction
      .insert(occurrenceReports)
      .values([
        {
          id: ids.reports.pothole,
          occurrenceId: ids.occurrences.pothole,
          reportedBy: ids.users.ana,
          originalDescription: 'Buraco ficticio para validacao do banco.',
          latitude: '-12.994100',
          longitude: '-38.459000',
          location: point('-38.459000', '-12.994100'),
          source: 'WEB_APP',
        },
        {
          id: ids.reports.lighting,
          occurrenceId: ids.occurrences.lighting,
          reportedBy: ids.users.ana,
          originalDescription: 'Poste ficticio sem iluminacao.',
          latitude: '-12.947900',
          longitude: '-38.363400',
          location: point('-38.363400', '-12.947900'),
          source: 'WEB_APP',
        },
      ])
      .onConflictDoNothing();

    await transaction
      .insert(occurrenceImages)
      .values([
        {
          id: ids.images.pothole,
          occurrenceId: ids.occurrences.pothole,
          reportId: ids.reports.pothole,
          uploadedBy: ids.users.ana,
          fileUrl: potholeImage.fileUrl,
          storageKey: potholeImage.storageKey,
          mimeType: potholeImage.mimeType,
          fileSize: potholeImage.fileSize,
          imageType: 'INITIAL',
          moderationStatus: 'APPROVED',
        },
        {
          id: ids.images.lighting,
          occurrenceId: ids.occurrences.lighting,
          reportId: ids.reports.lighting,
          uploadedBy: ids.users.ana,
          fileUrl: lightingImage.fileUrl,
          storageKey: lightingImage.storageKey,
          mimeType: lightingImage.mimeType,
          fileSize: lightingImage.fileSize,
          imageType: 'AFTER_REPAIR',
          moderationStatus: 'APPROVED',
        },
      ])
      .onConflictDoUpdate({
        target: occurrenceImages.id,
        set: {
          fileUrl: sql`excluded.file_url`,
          storageKey: sql`excluded.storage_key`,
          mimeType: sql`excluded.mime_type`,
          fileSize: sql`excluded.file_size`,
          imageType: sql`excluded.image_type`,
          moderationStatus: sql`excluded.moderation_status`,
        },
      });

    await transaction
      .insert(occurrenceConfirmations)
      .values({
        id: ids.confirmations.pothole,
        occurrenceId: ids.occurrences.pothole,
        userId: ids.users.carla,
        directlyAffected: false,
        problemWorsened: true,
        comment: 'Confirmacao ficticia do seed.',
      })
      .onConflictDoNothing();

    await transaction
      .insert(occurrenceStatusHistory)
      .values([
        {
          id: ids.histories.potholePublished,
          occurrenceId: ids.occurrences.pothole,
          previousStatus: 'PENDING_REVIEW',
          newStatus: 'PUBLISHED',
          changedBy: ids.users.bruno,
          reason: 'Publicacao ficticia do seed da Fase 1.',
          publicMessage: 'Ocorrencia publicada para demonstracao.',
        },
        {
          id: ids.histories.lightingCreated,
          occurrenceId: ids.occurrences.lighting,
          previousStatus: null,
          newStatus: 'PENDING_REVIEW',
          changedBy: ids.users.ana,
          reason: 'Criacao ficticia do seed da Fase 1.',
        },
        {
          id: ids.histories.lightingResolved,
          occurrenceId: ids.occurrences.lighting,
          previousStatus: 'IN_PROGRESS',
          newStatus: 'RESOLVED',
          changedBy: ids.users.bruno,
          reason: 'Resolucao ficticia do seed da Fase 1.',
          publicMessage: 'Iluminacao restabelecida em cenario de demonstracao.',
        },
      ])
      .onConflictDoNothing();

    await transaction
      .insert(repairEvaluations)
      .values({
        id: ids.evaluations.lighting,
        occurrenceId: ids.occurrences.lighting,
        userId: ids.users.ana,
        rating: 5,
        problemResolved: true,
        serviceQuality: 4,
        comment: 'Avaliacao ficticia para validar constraints e relacionamentos.',
      })
      .onConflictDoNothing();

    const seededAiResponse = {
      category: 'POTHOLE',
      subcategory: 'ASPHALT_DAMAGE',
      severity: 3,
      risk: 'MEDIUM',
      confidence: 0.91,
      summary: 'Classificacao ficticia e segura para validar a integracao da Fase 7.',
      requiresHumanReview: false,
      possibleDuplicates: [],
    };
    await transaction
      .insert(aiAnalyses)
      .values({
        id: ids.aiAnalyses.potholeClassification,
        occurrenceId: ids.occurrences.pothole,
        reportId: ids.reports.pothole,
        analysisType: 'CLASSIFICATION',
        modelName: 'phase-7-seed-model',
        suggestedCategory: 'POTHOLE',
        suggestedSubcategory: 'ASPHALT_DAMAGE',
        suggestedSeverity: 3,
        suggestedRisk: 'MEDIUM',
        confidence: '0.910',
        summary: seededAiResponse.summary,
        possibleDuplicates: [],
        rawResult: {
          state: 'VALIDATED',
          attempts: 1,
          received: seededAiResponse,
          validated: seededAiResponse,
        },
        requiresHumanReview: false,
      })
      .onConflictDoUpdate({
        target: aiAnalyses.id,
        set: {
          rawResult: {
            state: 'VALIDATED',
            attempts: 1,
            received: seededAiResponse,
            validated: seededAiResponse,
          },
          requiresHumanReview: false,
        },
      });

    await transaction
      .insert(notifications)
      .values([
        {
          id: ids.notifications.pothole,
          userId: ids.users.ana,
          type: 'OCCURRENCE_CREATED',
          title: 'Ocorrencia registrada',
          message: 'A ocorrencia ficticia TNR-2026-000001 foi registrada.',
          entityType: 'occurrence',
          entityId: ids.occurrences.pothole,
        },
        {
          id: ids.notifications.lighting,
          userId: ids.users.ana,
          type: 'STATUS_CHANGED',
          title: 'Ocorrencia resolvida',
          message: 'A ocorrencia ficticia TNR-2026-000002 foi resolvida.',
          entityType: 'occurrence',
          entityId: ids.occurrences.lighting,
        },
      ])
      .onConflictDoNothing();

    await transaction
      .insert(auditLogs)
      .values({
        id: ids.auditLogs.pothole,
        userId: ids.users.ana,
        action: 'PHASE_ONE_SEED_OCCURRENCE_CREATED',
        entityType: 'occurrence',
        entityId: ids.occurrences.pothole,
        newData: { protocol: 'TNR-2026-000001', fixture: true },
      })
      .onConflictDoNothing();

    await transaction
      .insert(webhookEvents)
      .values({
        id: ids.webhookEvents.telegramReport,
        provider: 'TELEGRAM',
        externalEventId: 'seed-telegram-report-2026-000001',
        eventType: 'REPORT_RECEIVED',
        payloadHash: '0'.repeat(64),
        status: 'PROCESSED',
        responseCode: 202,
        processedAt: new Date('2026-07-18T15:00:00.000Z'),
        receivedAt: new Date('2026-07-18T15:00:00.000Z'),
      })
      .onConflictDoNothing();

    await transaction
      .insert(outboxEvents)
      .values({
        id: ids.outboxEvents.telegramReport,
        eventType: 'TELEGRAM_REPORT_RECEIVED',
        entityType: 'webhook_event',
        entityId: ids.webhookEvents.telegramReport,
        payload: {
          webhookEventId: ids.webhookEvents.telegramReport,
          source: 'TELEGRAM',
          fixture: true,
        },
        status: 'PENDING',
        attempts: 0,
        availableAt: new Date('2026-07-18T15:00:00.000Z'),
        createdAt: new Date('2026-07-18T15:00:00.000Z'),
      })
      .onConflictDoNothing();

    await transaction
      .insert(protocolCounters)
      .values({ year: 2026, lastValue: 2 })
      .onConflictDoUpdate({
        target: protocolCounters.year,
        set: {
          lastValue: sql`GREATEST(${protocolCounters.lastValue}, 2)`,
          updatedAt: new Date(),
        },
      });
  });

  logger.info(
    {
      postgisVersion: health.postgisVersion,
      municipalities: 2,
      neighborhoods: 3,
      categories: categorySeed.length,
      departments: 3,
      preparedUsers: 7,
      profiles: 4,
      revokedSessions: 1,
      occurrences: 2,
      aiAnalyses: 1,
      webhookEvents: 1,
      outboxEvents: 1,
    },
    'Seed idempotente ate a Fase 9 executado com credenciais Argon2id e cenarios seguros.',
  );
}

try {
  await runSeed();
} catch (error) {
  logger.error({ err: error }, 'Falha ao executar o seed ate a Fase 9.');
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
