import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  getHeatmapAnalytics,
  getOperationsFilterOptions,
  type CategoryItem,
  type DashboardFilters,
  type DashboardSummary,
  type HeatmapCell,
  type NeighborhoodItem,
  type OccurrenceStatus,
  type StatusGroupItem,
} from './api';
import { MunicipalHeatmap } from './heatmap-map';

const statusOptions: { value: OccurrenceStatus; label: string }[] = [
  { value: 'PENDING_REVIEW', label: 'Em revisão' },
  { value: 'PUBLISHED', label: 'Publicada' },
  { value: 'FORWARDED', label: 'Encaminhada' },
  { value: 'ACKNOWLEDGED', label: 'Recebida' },
  { value: 'UNDER_ANALYSIS', label: 'Em análise' },
  { value: 'SCHEDULED', label: 'Agendada' },
  { value: 'IN_PROGRESS', label: 'Em atendimento' },
  { value: 'RESOLVED', label: 'Resolvida' },
  { value: 'CONTESTED', label: 'Contestada' },
  { value: 'CLOSED', label: 'Encerrada' },
  { value: 'REJECTED', label: 'Rejeitada' },
  { value: 'DUPLICATE', label: 'Duplicada' },
];

const statusLabels = new Map(statusOptions.map((option) => [option.value, option.label]));

interface HeatmapData {
  summary: DashboardSummary;
  cells: HeatmapCell[];
  cellSizeMeters: number;
  neighborhoods: NeighborhoodItem[];
  categories: CategoryItem[];
  statuses: StatusGroupItem[];
}

function readFilters(): DashboardFilters {
  const query = new URLSearchParams(window.location.search);
  const status = query.get('status');
  return {
    categoryId: query.get('categoryId') || undefined,
    neighborhoodId: query.get('neighborhoodId') || undefined,
    status: statusOptions.some((option) => option.value === status)
      ? (status as OccurrenceStatus)
      : undefined,
    startDate: query.get('startDate') || undefined,
    endDate: query.get('endDate') || undefined,
  };
}

function writeFilters(filters: DashboardFilters): void {
  const query = new URLSearchParams({ view: 'heatmap' });
  if (filters.categoryId) query.set('categoryId', filters.categoryId);
  if (filters.neighborhoodId) query.set('neighborhoodId', filters.neighborhoodId);
  if (filters.status) query.set('status', filters.status);
  if (filters.startDate) query.set('startDate', filters.startDate);
  if (filters.endDate) query.set('endDate', filters.endDate);
  window.history.replaceState({}, '', `${window.location.pathname}?${query.toString()}`);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function mergeNeighborhoods(items: NeighborhoodItem[]): NeighborhoodItem[] {
  const merged = new Map<string, NeighborhoodItem>();
  for (const item of items) {
    const normalizedName = item.name.trim().toLocaleLowerCase('pt-BR');
    const current = merged.get(normalizedName);
    if (current) {
      current.count += item.count;
      current.percentage += item.percentage;
    } else {
      merged.set(normalizedName, { ...item });
    }
  }
  return [...merged.values()].sort(
    (left, right) => right.count - left.count || left.name.localeCompare(right.name, 'pt-BR'),
  );
}

function InsightList({
  title,
  eyebrow,
  items,
  empty,
}: {
  title: string;
  eyebrow: string;
  items: { key: string; label: string; count: number; percentage: number }[];
  empty: string;
}) {
  return (
    <article className="territory-card">
      <div className="territory-card__heading">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="territory-card__empty">{empty}</p>
      ) : (
        <ol className="territory-ranking">
          {items.map((item, index) => (
            <li key={item.key}>
              <span className="territory-ranking__position">{index + 1}</span>
              <span className="territory-ranking__name">
                <strong>{item.label}</strong>
                <i>
                  <span style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                </i>
              </span>
              <span className="territory-ranking__value">
                <strong>{formatNumber(item.count)}</strong>
                <small>{item.percentage.toFixed(1)}%</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export function HeatmapPage({ onLogout }: { onLogout: () => Promise<void> }) {
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(() => readFilters());
  const [filters, setFilters] = useState<DashboardFilters>(() => readFilters());
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodItem[]>([]);
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getHeatmapAnalytics(filters));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível carregar a análise territorial.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const loadOptions = window.setTimeout(() => {
      void getOperationsFilterOptions()
        .then((options) => {
          setCategories(options.categories);
          setNeighborhoods(options.neighborhoods);
        })
        .catch(() => {
          setCategories([]);
          setNeighborhoods([]);
        });
    }, 0);
    return () => window.clearTimeout(loadOptions);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadAnalytics(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadAnalytics]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      draftFilters.startDate &&
      draftFilters.endDate &&
      draftFilters.endDate < draftFilters.startDate
    ) {
      setError('A data final deve ser igual ou posterior à data inicial.');
      return;
    }
    setFilters(draftFilters);
    writeFilters(draftFilters);
  }

  function clearFilters() {
    const empty = {};
    setDraftFilters(empty);
    setFilters(empty);
    writeFilters(empty);
  }

  const peakCell = data?.cells.reduce<HeatmapCell | null>(
    (peak, cell) => (!peak || cell.occurrenceCount > peak.occurrenceCount ? cell : peak),
    null,
  );
  const rankedNeighborhoods = mergeNeighborhoods(data?.neighborhoods ?? []);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <section className="heatmap-page">
      <header className="dashboard__header heatmap-page__header">
        <div>
          <span className="eyebrow">Inteligência territorial</span>
          <h1>Mapa de calor da cidade</h1>
          <p>Encontre concentrações, compare bairros e direcione as equipes com dados reais.</p>
        </div>
        <div className="header-actions">
          <span className="live-indicator">
            <i aria-hidden="true" /> Células de 250 m
          </span>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void loadAnalytics()}
            disabled={loading}
          >
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
          <button className="text-button" type="button" onClick={() => void onLogout()}>
            Sair
          </button>
        </div>
      </header>

      <form className="heatmap-filters" onSubmit={applyFilters}>
        <div className="heatmap-filters__heading">
          <span aria-hidden="true">⌁</span>
          <span>
            <strong>Refinar análise</strong>
            <small>
              {activeFilterCount
                ? `${activeFilterCount} ${activeFilterCount === 1 ? 'filtro ativo' : 'filtros ativos'}`
                : 'Toda a base municipal'}
            </small>
          </span>
        </div>
        <label>
          Categoria
          <select
            value={draftFilters.categoryId ?? ''}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                categoryId: event.target.value || undefined,
              }))
            }
          >
            <option value="">Todas</option>
            {categories
              .filter((category) => category.key !== null)
              .map((category) => (
                <option key={category.key} value={category.key ?? ''}>
                  {category.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Bairro
          <select
            value={draftFilters.neighborhoodId ?? ''}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                neighborhoodId: event.target.value || undefined,
              }))
            }
          >
            <option value="">Todos</option>
            {neighborhoods
              .filter((neighborhood) => neighborhood.key !== null)
              .map((neighborhood) => (
                <option key={neighborhood.key} value={neighborhood.key ?? ''}>
                  {neighborhood.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={draftFilters.status ?? ''}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                status: (event.target.value as OccurrenceStatus) || undefined,
              }))
            }
          >
            <option value="">Todos</option>
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          De
          <input
            type="date"
            value={draftFilters.startDate ?? ''}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                startDate: event.target.value || undefined,
              }))
            }
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={draftFilters.endDate ?? ''}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                endDate: event.target.value || undefined,
              }))
            }
          />
        </label>
        <div className="heatmap-filters__actions">
          <button className="primary-button" type="submit">
            Aplicar
          </button>
          <button className="text-button" type="button" onClick={clearFilters}>
            Limpar
          </button>
        </div>
      </form>

      {error && (
        <div className="dashboard-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void loadAnalytics()}>
            Tentar novamente
          </button>
        </div>
      )}

      <section className="heatmap-metric-grid" aria-label="Resumo territorial">
        <article>
          <span className="heatmap-metric__icon heatmap-metric__icon--blue">◎</span>
          <span>
            <small>Ocorrências no recorte</small>
            <strong>{data ? formatNumber(data.summary.totalOccurrences) : '—'}</strong>
          </span>
        </article>
        <article>
          <span className="heatmap-metric__icon heatmap-metric__icon--red">◉</span>
          <span>
            <small>Pico em uma célula</small>
            <strong>{peakCell ? formatNumber(peakCell.occurrenceCount) : '—'}</strong>
          </span>
        </article>
        <article>
          <span className="heatmap-metric__icon heatmap-metric__icon--orange">↗</span>
          <span>
            <small>Prioridade média</small>
            <strong>
              {data ? data.summary.averagePriorityScore.toFixed(1).replace('.', ',') : '—'}
            </strong>
          </span>
        </article>
        <article>
          <span className="heatmap-metric__icon heatmap-metric__icon--green">⌖</span>
          <span>
            <small>Bairro com mais registros</small>
            <strong className="heatmap-metric__name">{rankedNeighborhoods[0]?.name ?? '—'}</strong>
          </span>
        </article>
      </section>

      <section className="territory-layout">
        <article className="heatmap-panel">
          <div className="heatmap-panel__heading">
            <div>
              <span className="eyebrow">Concentração geográfica</span>
              <h2>Onde a cidade mais precisa de atenção</h2>
            </div>
            <span>
              {data
                ? `${data.cells.length} ${data.cells.length === 1 ? 'célula ativa' : 'células ativas'}`
                : 'Carregando…'}
            </span>
          </div>
          <MunicipalHeatmap cells={data?.cells ?? []} loading={loading} />
        </article>

        <aside className="territory-insights" aria-label="Indicadores territoriais">
          <InsightList
            eyebrow="Bairros"
            title="Maior concentração"
            empty="Nenhum bairro contabilizado."
            items={rankedNeighborhoods.slice(0, 5).map((item) => ({
              key: item.key ?? item.name,
              label: item.name,
              count: item.count,
              percentage: item.percentage,
            }))}
          />
          <InsightList
            eyebrow="Categorias"
            title="Problemas recorrentes"
            empty="Nenhuma categoria contabilizada."
            items={(data?.categories ?? []).slice(0, 5).map((item) => ({
              key: item.key ?? item.name,
              label: item.name,
              count: item.count,
              percentage: item.percentage,
            }))}
          />
        </aside>
      </section>

      <section className="status-distribution" aria-label="Distribuição por status">
        <div>
          <span className="eyebrow">Fluxo operacional</span>
          <h2>Distribuição por status</h2>
        </div>
        <div className="status-distribution__items">
          {(data?.statuses ?? []).slice(0, 6).map((status, index) => (
            <article key={status.key ?? status.name}>
              <i className={`status-distribution__dot status-distribution__dot--${index + 1}`} />
              <span>
                <small>{statusLabels.get(status.key as OccurrenceStatus) ?? status.name}</small>
                <strong>{formatNumber(status.count)}</strong>
              </span>
              <em>{status.percentage.toFixed(1)}%</em>
            </article>
          ))}
          {!loading && (data?.statuses.length ?? 0) === 0 && (
            <p>Nenhum status contabilizado para este recorte.</p>
          )}
        </div>
      </section>
    </section>
  );
}
