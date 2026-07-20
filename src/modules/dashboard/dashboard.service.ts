import { AppError } from '../../shared/errors/app-error.js';
import type { RequestPrincipal } from '../occurrences/occurrences.types.js';
import type {
  DashboardExportQuery,
  DashboardQuery,
  PriorityRankingQuery,
} from './dashboard.schemas.js';
import type {
  DashboardExport,
  DashboardExportRow,
  DashboardFilters,
  DashboardRepository,
  DashboardService,
} from './dashboard.types.js';

function csvCell(value: Date | number | string | null): string {
  if (value === null) return '';
  const isText = typeof value === 'string';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (isText && /^[=+\-@\t\r]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csvLine(values: (Date | number | string | null)[]): string {
  return values.map(csvCell).join(',');
}

function exportCsv(rows: DashboardExportRow[]): string {
  const header = [
    'protocol',
    'title',
    'municipality_name',
    'category_code',
    'category_name',
    'neighborhood_name',
    'status',
    'severity',
    'risk_level',
    'priority_score',
    'confirmation_count',
    'first_reported_at',
    'resolved_at',
    'created_at',
  ];
  const lines = rows.map((row) =>
    csvLine([
      row.protocol,
      row.title,
      row.municipalityName,
      row.categoryCode,
      row.categoryName,
      row.neighborhoodName,
      row.status,
      row.severity,
      row.riskLevel,
      row.priorityScore,
      row.confirmationCount,
      row.firstReportedAt,
      row.resolvedAt,
      row.createdAt,
    ]),
  );
  return `\uFEFF${header.join(',')}\r\n${lines.join('\r\n')}${lines.length === 0 ? '' : '\r\n'}`;
}

function responseFilters(filters: DashboardFilters): Record<string, unknown> {
  return {
    municipalityId: filters.municipalityId ?? null,
    categoryId: filters.categoryId ?? null,
    neighborhoodId: filters.neighborhoodId ?? null,
    status: filters.status ?? null,
    startDate: filters.startDate?.toISOString() ?? null,
    endDate: filters.endDate?.toISOString() ?? null,
  };
}

export class DefaultDashboardService implements DashboardService {
  public constructor(
    private readonly repository: DashboardRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async summary(principal: RequestPrincipal, query: DashboardQuery): Promise<unknown> {
    const filters = this.scopedFilters(principal, query);
    return { filters: responseFilters(filters), summary: await this.repository.summary(filters) };
  }

  public async byCategory(principal: RequestPrincipal, query: DashboardQuery): Promise<unknown> {
    const filters = this.scopedFilters(principal, query);
    return {
      filters: responseFilters(filters),
      categories: await this.repository.byCategory(filters),
    };
  }

  public async byNeighborhood(
    principal: RequestPrincipal,
    query: DashboardQuery,
  ): Promise<unknown> {
    const filters = this.scopedFilters(principal, query);
    return {
      filters: responseFilters(filters),
      neighborhoods: await this.repository.byNeighborhood(filters),
    };
  }

  public async byStatus(principal: RequestPrincipal, query: DashboardQuery): Promise<unknown> {
    const filters = this.scopedFilters(principal, query);
    return { filters: responseFilters(filters), statuses: await this.repository.byStatus(filters) };
  }

  public async priorityRanking(
    principal: RequestPrincipal,
    query: PriorityRankingQuery,
  ): Promise<unknown> {
    const filters = this.scopedFilters(principal, query);
    return {
      filters: responseFilters(filters),
      limit: query.limit,
      occurrences: await this.repository.priorityRanking(filters, query.limit),
    };
  }

  public async resolutionTime(
    principal: RequestPrincipal,
    query: DashboardQuery,
  ): Promise<unknown> {
    const filters = this.scopedFilters(principal, query);
    return {
      filters: responseFilters(filters),
      resolutionTime: await this.repository.resolutionTime(filters),
    };
  }

  public async heatmap(principal: RequestPrincipal, query: DashboardQuery): Promise<unknown> {
    const filters = this.scopedFilters(principal, query);
    return {
      filters: responseFilters(filters),
      cellSizeMeters: 250,
      cells: await this.repository.heatmap(filters),
    };
  }

  public async export(
    principal: RequestPrincipal,
    query: DashboardExportQuery,
  ): Promise<DashboardExport> {
    const filters = this.scopedFilters(principal, query);
    const rows = await this.repository.exportRows(filters, query.limit + 1);
    const truncated = rows.length > query.limit;
    const selected = rows.slice(0, query.limit);
    return {
      filename: `dashboard-${this.now().toISOString().slice(0, 10)}.csv`,
      content: exportCsv(selected),
      rowCount: selected.length,
      truncated,
      limit: query.limit,
    };
  }

  private scopedFilters(
    principal: RequestPrincipal,
    query: DashboardQuery | DashboardExportQuery | PriorityRankingQuery,
  ): DashboardFilters {
    if (principal.role === 'CITIZEN') {
      throw new AppError(403, 'FORBIDDEN', 'Seu perfil nao acessa o painel municipal.');
    }
    let municipalityId = query.municipalityId;
    if (principal.role === 'CITY_OPERATOR') {
      if (
        principal.municipalityId === null ||
        (municipalityId !== undefined && municipalityId !== principal.municipalityId)
      ) {
        throw new AppError(403, 'MUNICIPALITY_FORBIDDEN', 'Acesso negado para este municipio.');
      }
      municipalityId = principal.municipalityId;
    }
    return {
      ...(municipalityId === undefined ? {} : { municipalityId }),
      ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
      ...(query.neighborhoodId === undefined ? {} : { neighborhoodId: query.neighborhoodId }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.startDate === undefined ? {} : { startDate: query.startDate }),
      ...(query.endDate === undefined ? {} : { endDate: query.endDate }),
    };
  }
}
