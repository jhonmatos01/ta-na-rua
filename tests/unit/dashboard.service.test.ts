import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { DefaultDashboardService } from '../../src/modules/dashboard/dashboard.service.js';
import type {
  DashboardExportRow,
  DashboardFilters,
  DashboardGroup,
  DashboardRepository,
  DashboardSummary,
  HeatmapCell,
  PriorityRankingItem,
  ResolutionTimeResult,
} from '../../src/modules/dashboard/dashboard.types.js';
import type { RequestPrincipal } from '../../src/modules/occurrences/occurrences.types.js';

const emptySummary: DashboardSummary = {
  totalOccurrences: 0,
  activeOccurrences: 0,
  resolvedOccurrences: 0,
  closedOccurrences: 0,
  contestedOccurrences: 0,
  rejectedOccurrences: 0,
  duplicateOccurrences: 0,
  totalConfirmations: 0,
  averagePriorityScore: 0,
  resolutionRate: 0,
};

class FakeDashboardRepository implements DashboardRepository {
  public lastFilters: DashboardFilters | null = null;
  public exportData: DashboardExportRow[] = [];

  public summary(filters: DashboardFilters): Promise<DashboardSummary> {
    this.lastFilters = filters;
    return Promise.resolve(emptySummary);
  }

  public byCategory(filters: DashboardFilters): Promise<DashboardGroup[]> {
    this.lastFilters = filters;
    return Promise.resolve([]);
  }

  public byNeighborhood(filters: DashboardFilters): Promise<DashboardGroup[]> {
    this.lastFilters = filters;
    return Promise.resolve([]);
  }

  public byStatus(filters: DashboardFilters): Promise<DashboardGroup[]> {
    this.lastFilters = filters;
    return Promise.resolve([]);
  }

  public priorityRanking(
    filters: DashboardFilters,
    _limit: number,
  ): Promise<PriorityRankingItem[]> {
    this.lastFilters = filters;
    return Promise.resolve([]);
  }

  public resolutionTime(filters: DashboardFilters): Promise<ResolutionTimeResult> {
    this.lastFilters = filters;
    return Promise.resolve({
      resolvedOccurrences: 0,
      averageHours: null,
      medianHours: null,
      percentile90Hours: null,
      minimumHours: null,
      maximumHours: null,
    });
  }

  public heatmap(filters: DashboardFilters): Promise<HeatmapCell[]> {
    this.lastFilters = filters;
    return Promise.resolve([]);
  }

  public exportRows(filters: DashboardFilters, _limit: number): Promise<DashboardExportRow[]> {
    this.lastFilters = filters;
    return Promise.resolve(this.exportData);
  }
}

function principal(overrides: Partial<RequestPrincipal> = {}): RequestPrincipal {
  return {
    sub: randomUUID(),
    role: 'CITY_OPERATOR',
    municipalityId: randomUUID(),
    ...overrides,
  };
}

function exportRow(overrides: Partial<DashboardExportRow> = {}): DashboardExportRow {
  return {
    protocol: 'TNR-2026-000001',
    title: 'Buraco na via',
    municipalityName: 'Sao Paulo',
    categoryCode: 'POTHOLE',
    categoryName: 'Buraco na via',
    neighborhoodName: 'Centro',
    status: 'PUBLISHED',
    severity: 3,
    riskLevel: 'MEDIUM',
    priorityScore: 42.5,
    confirmationCount: 2,
    firstReportedAt: new Date('2026-07-18T10:00:00.000Z'),
    resolvedAt: null,
    createdAt: new Date('2026-07-18T10:00:00.000Z'),
    ...overrides,
  };
}

describe('DefaultDashboardService', () => {
  it('limita o operador ao municipio do token e serializa os filtros', async () => {
    const repository = new FakeDashboardRepository();
    const service = new DefaultDashboardService(repository);
    const operator = principal();
    const startDate = new Date('2026-07-01T00:00:00.000Z');
    const result = await service.summary(operator, { startDate });
    expect(repository.lastFilters).toEqual({
      municipalityId: operator.municipalityId,
      startDate,
    });
    expect(result).toMatchObject({
      filters: {
        municipalityId: operator.municipalityId,
        startDate: startDate.toISOString(),
      },
      summary: emptySummary,
    });
  });

  it('nega outro municipio ao operador e nega cidadaos', async () => {
    const service = new DefaultDashboardService(new FakeDashboardRepository());
    await expect(
      service.summary(principal(), { municipalityId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'MUNICIPALITY_FORBIDDEN' });
    await expect(service.summary(principal({ role: 'CITIZEN' }), {})).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(service.summary(principal({ municipalityId: null }), {})).rejects.toMatchObject({
      code: 'MUNICIPALITY_FORBIDDEN',
    });
  });

  it('permite escopo global ou municipio selecionado para moderador e administrador', async () => {
    const repository = new FakeDashboardRepository();
    const service = new DefaultDashboardService(repository);
    await service.byCategory(principal({ role: 'MODERATOR', municipalityId: null }), {});
    expect(repository.lastFilters).toEqual({});
    const municipalityId = randomUUID();
    await service.byNeighborhood(principal({ role: 'ADMIN', municipalityId: null }), {
      municipalityId,
      status: 'PUBLISHED',
    });
    expect(repository.lastFilters).toEqual({ municipalityId, status: 'PUBLISHED' });
  });

  it('encaminha todos os indicadores sem consultas por item', async () => {
    const repository = new FakeDashboardRepository();
    const service = new DefaultDashboardService(repository);
    const admin = principal({ role: 'ADMIN', municipalityId: null });
    await expect(service.byStatus(admin, {})).resolves.toMatchObject({ statuses: [] });
    await expect(service.priorityRanking(admin, { limit: 10 })).resolves.toMatchObject({
      limit: 10,
      occurrences: [],
    });
    await expect(service.resolutionTime(admin, {})).resolves.toHaveProperty('resolutionTime');
    await expect(service.heatmap(admin, {})).resolves.toMatchObject({
      cellSizeMeters: 250,
      cells: [],
    });
  });

  it('gera CSV limitado, sem dados pessoais e protegido contra formulas', async () => {
    const repository = new FakeDashboardRepository();
    repository.exportData = [
      exportRow({ title: '=HYPERLINK("https://invalid.test")' }),
      exportRow({ protocol: 'TNR-2026-000002' }),
    ];
    const service = new DefaultDashboardService(
      repository,
      () => new Date('2026-07-19T12:00:00.000Z'),
    );
    const result = await service.export(principal({ role: 'ADMIN' }), {
      format: 'csv',
      limit: 1,
    });
    expect(result).toMatchObject({
      filename: 'dashboard-2026-07-19.csv',
      rowCount: 1,
      limit: 1,
      truncated: true,
    });
    expect(result.content).toContain(`"'=HYPERLINK(""https://invalid.test"")"`);
    expect(result.content).not.toMatch(
      /created_by|email|phone|address|description|latitude|longitude/u,
    );
    expect(result.content.charCodeAt(0)).toBe(0xfeff);
  });
});
