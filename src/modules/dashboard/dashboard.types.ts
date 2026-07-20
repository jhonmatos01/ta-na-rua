import type { RequestPrincipal } from '../occurrences/occurrences.types.js';
import type {
  DashboardExportQuery,
  DashboardQuery,
  PriorityRankingQuery,
} from './dashboard.schemas.js';

export interface DashboardFilters {
  municipalityId?: string;
  categoryId?: string;
  neighborhoodId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface DashboardSummary {
  totalOccurrences: number;
  activeOccurrences: number;
  resolvedOccurrences: number;
  closedOccurrences: number;
  contestedOccurrences: number;
  rejectedOccurrences: number;
  duplicateOccurrences: number;
  totalConfirmations: number;
  averagePriorityScore: number;
  resolutionRate: number;
}

export interface DashboardGroup {
  key: string | null;
  code?: string | null;
  name: string;
  count: number;
  percentage: number;
}

export interface PriorityRankingItem {
  occurrenceId: string;
  protocol: string;
  title: string;
  municipalityId: string;
  municipalityName: string;
  categoryCode: string | null;
  categoryName: string | null;
  neighborhoodName: string | null;
  status: string;
  severity: number | null;
  riskLevel: string | null;
  priorityScore: number;
  confirmationCount: number;
  createdAt: Date;
}

export interface ResolutionTimeResult {
  resolvedOccurrences: number;
  averageHours: number | null;
  medianHours: number | null;
  percentile90Hours: number | null;
  minimumHours: number | null;
  maximumHours: number | null;
}

export interface HeatmapCell {
  latitude: number;
  longitude: number;
  occurrenceCount: number;
  averagePriorityScore: number;
}

export interface DashboardExportRow {
  protocol: string;
  title: string;
  municipalityName: string;
  categoryCode: string | null;
  categoryName: string | null;
  neighborhoodName: string | null;
  status: string;
  severity: number | null;
  riskLevel: string | null;
  priorityScore: number;
  confirmationCount: number;
  firstReportedAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface DashboardExport {
  filename: string;
  content: string;
  rowCount: number;
  truncated: boolean;
  limit: number;
}

export interface DashboardRepository {
  summary(filters: DashboardFilters): Promise<DashboardSummary>;
  byCategory(filters: DashboardFilters): Promise<DashboardGroup[]>;
  byNeighborhood(filters: DashboardFilters): Promise<DashboardGroup[]>;
  byStatus(filters: DashboardFilters): Promise<DashboardGroup[]>;
  priorityRanking(filters: DashboardFilters, limit: number): Promise<PriorityRankingItem[]>;
  resolutionTime(filters: DashboardFilters): Promise<ResolutionTimeResult>;
  heatmap(filters: DashboardFilters): Promise<HeatmapCell[]>;
  exportRows(filters: DashboardFilters, limit: number): Promise<DashboardExportRow[]>;
}

export interface DashboardService {
  summary(principal: RequestPrincipal, query: DashboardQuery): Promise<unknown>;
  byCategory(principal: RequestPrincipal, query: DashboardQuery): Promise<unknown>;
  byNeighborhood(principal: RequestPrincipal, query: DashboardQuery): Promise<unknown>;
  byStatus(principal: RequestPrincipal, query: DashboardQuery): Promise<unknown>;
  priorityRanking(principal: RequestPrincipal, query: PriorityRankingQuery): Promise<unknown>;
  resolutionTime(principal: RequestPrincipal, query: DashboardQuery): Promise<unknown>;
  heatmap(principal: RequestPrincipal, query: DashboardQuery): Promise<unknown>;
  export(principal: RequestPrincipal, query: DashboardExportQuery): Promise<DashboardExport>;
}
