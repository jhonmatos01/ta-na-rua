import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  getOccurrenceDetail,
  getOperationsFilterOptions,
  listOccurrences,
  resolveAssetUrl,
  type CategoryItem,
  type NeighborhoodItem,
  type OccurrenceFilters,
  type OccurrenceStatus,
  type OccurrenceTimelineItem,
  type OperationalOccurrence,
} from './api';

const statusLabels: Record<OccurrenceStatus, string> = {
  PENDING_REVIEW: 'Em revisão',
  PUBLISHED: 'Publicada',
  FORWARDED: 'Encaminhada',
  ACKNOWLEDGED: 'Recebida',
  UNDER_ANALYSIS: 'Em análise',
  SCHEDULED: 'Agendada',
  IN_PROGRESS: 'Em atendimento',
  RESOLVED: 'Resolvida',
  CONTESTED: 'Contestada',
  CLOSED: 'Encerrada',
  REJECTED: 'Rejeitada',
  DUPLICATE: 'Duplicada',
};

const statuses = Object.entries(statusLabels) as [OccurrenceStatus, string][];

interface OperationsUrlState {
  filters: OccurrenceFilters;
  selectedOccurrenceId: string | null;
}

function readUrlState(): OperationsUrlState {
  const parameters = new URLSearchParams(window.location.search);
  const status = parameters.get('status');
  const category = parameters.get('category');
  const neighborhood = parameters.get('neighborhood');
  const startDate = parameters.get('startDate');
  const endDate = parameters.get('endDate');
  const page = Number(parameters.get('page') ?? '1');
  return {
    filters: {
      page: Number.isInteger(page) && page > 0 ? page : 1,
      ...(statuses.some(([value]) => value === status)
        ? { status: status as OccurrenceStatus }
        : {}),
      ...(category ? { category } : {}),
      ...(neighborhood ? { neighborhood } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    },
    selectedOccurrenceId: parameters.get('selected'),
  };
}

function writeUrlState(state: OperationsUrlState, replace = false): void {
  const parameters = new URLSearchParams();
  parameters.set('view', 'occurrences');
  if (state.filters.status) parameters.set('status', state.filters.status);
  if (state.filters.category) parameters.set('category', state.filters.category);
  if (state.filters.neighborhood) parameters.set('neighborhood', state.filters.neighborhood);
  if (state.filters.startDate) parameters.set('startDate', state.filters.startDate);
  if (state.filters.endDate) parameters.set('endDate', state.filters.endDate);
  if (state.filters.page > 1) parameters.set('page', String(state.filters.page));
  if (state.selectedOccurrenceId) parameters.set('selected', state.selectedOccurrenceId);
  const url = `${window.location.pathname}?${parameters.toString()}`;
  if (replace) {
    window.history.replaceState({}, '', url);
  } else {
    window.history.pushState({}, '', url);
  }
}

function neighborhoodName(occurrence: OperationalOccurrence): string {
  if (typeof occurrence.neighborhood === 'string') return occurrence.neighborhood;
  return occurrence.neighborhood?.name ?? 'Não informado';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function OccurrencePhoto({
  occurrence,
  compact = false,
}: {
  occurrence: OperationalOccurrence;
  compact?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = occurrence.images
    .map((image) => resolveAssetUrl(image.url))
    .find((value): value is string => value !== null);

  if (!source || failedSource === source) {
    return (
      <div
        className={`occurrence-photo occurrence-photo--empty ${compact ? 'occurrence-photo--compact' : ''}`}
        role="img"
        aria-label="Imagem não disponível"
      >
        <span aria-hidden="true">▧</span>
      </div>
    );
  }
  return (
    <img
      className={`occurrence-photo ${compact ? 'occurrence-photo--compact' : ''}`}
      src={source}
      alt={`Imagem da ocorrência ${occurrence.protocol}`}
      onError={() => setFailedSource(source)}
    />
  );
}

function StatusBadge({ status }: { status: OccurrenceStatus }) {
  return <span className={`status status--${status.toLowerCase()}`}>{statusLabels[status]}</span>;
}

function DetailPanel({ occurrenceId, onClose }: { occurrenceId: string; onClose: () => void }) {
  const [occurrence, setOccurrence] = useState<OperationalOccurrence | null>(null);
  const [timeline, setTimeline] = useState<OccurrenceTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getOccurrenceDetail(occurrenceId)
      .then((result) => {
        if (!active) return;
        setOccurrence(result.occurrence);
        setTimeline(result.timeline);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Não foi possível abrir o chamado.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [occurrenceId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="detail-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="detail-panel__header">
          <div>
            <span className="eyebrow">Leitura operacional</span>
            <h2 id="detail-title">{occurrence?.protocol ?? 'Carregando chamado'}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes"
          >
            ×
          </button>
        </header>

        {loading ? (
          <div className="detail-loading" role="status">
            <span className="loader" aria-hidden="true" />
            Carregando informações…
          </div>
        ) : error || occurrence === null ? (
          <div className="detail-error" role="alert">
            {error ?? 'Chamado não encontrado.'}
          </div>
        ) : (
          <div className="detail-panel__content">
            <OccurrencePhoto occurrence={occurrence} />
            <div className="detail-title-row">
              <div>
                <StatusBadge status={occurrence.status} />
                <h3>{occurrence.title}</h3>
                <p>
                  {occurrence.category?.name ?? 'Sem categoria'} · {neighborhoodName(occurrence)}
                </p>
              </div>
              <div className="detail-priority">
                <small>Prioridade</small>
                <strong>{occurrence.priorityScore.toFixed(1)}</strong>
              </div>
            </div>

            <p className="detail-description">
              {occurrence.description ?? 'Nenhuma descrição foi informada.'}
            </p>

            <dl className="detail-metrics">
              <div>
                <dt>Confirmações</dt>
                <dd>{occurrence.confirmationCount}</dd>
              </div>
              <div>
                <dt>Risco</dt>
                <dd>{occurrence.riskLevel ?? 'Não classificado'}</dd>
              </div>
              <div>
                <dt>Gravidade</dt>
                <dd>{occurrence.severity ?? 'Não classificada'}</dd>
              </div>
              <div>
                <dt>Registrada em</dt>
                <dd>{formatDate(occurrence.createdAt)}</dd>
              </div>
            </dl>

            <section className="restricted-location" aria-labelledby="location-title">
              <div>
                <span aria-hidden="true">⌖</span>
                <div>
                  <h4 id="location-title">Localização operacional</h4>
                  <p>Acesso restrito à equipe autorizada deste município.</p>
                </div>
              </div>
              <strong>{occurrence.address ?? neighborhoodName(occurrence)}</strong>
              <code>
                {occurrence.location.latitude.toFixed(6)},{' '}
                {occurrence.location.longitude.toFixed(6)}
              </code>
            </section>

            <section className="timeline" aria-labelledby="timeline-title">
              <div className="section-heading">
                <span className="eyebrow">Rastreabilidade</span>
                <h4 id="timeline-title">Histórico do atendimento</h4>
              </div>
              {timeline.length === 0 ? (
                <p className="timeline-empty">Ainda não há movimentações registradas.</p>
              ) : (
                <ol>
                  {timeline.map((item) => (
                    <li key={item.id}>
                      <span className="timeline__dot" aria-hidden="true" />
                      <div>
                        <strong>{statusLabels[item.newStatus]}</strong>
                        <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                        {item.publicMessage && <p>{item.publicMessage}</p>}
                        {item.reason && <small>Motivo interno: {item.reason}</small>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

export function OperationsPage({ onLogout }: { onLogout: () => Promise<void> }) {
  const [initialState] = useState(() => readUrlState());
  const [filters, setFilters] = useState<OccurrenceFilters>(initialState.filters);
  const [draftFilters, setDraftFilters] = useState<OccurrenceFilters>(initialState.filters);
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | null>(
    initialState.selectedOccurrenceId,
  );
  const [occurrences, setOccurrences] = useState<OperationalOccurrence[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);

  const loadOccurrences = useCallback(async (activeFilters: OccurrenceFilters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listOccurrences(activeFilters);
      setOccurrences(result.occurrences);
      setPagination({
        page: result.pagination.page,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar a fila.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadOccurrences(filters), 0);
    return () => window.clearTimeout(initialLoad);
  }, [filters, loadOccurrences]);

  useEffect(() => {
    let active = true;
    void getOperationsFilterOptions()
      .then((result) => {
        if (!active) return;
        setCategories(result.categories.filter((category) => category.code || category.key));
        setNeighborhoods(
          result.neighborhoods.filter(
            (neighborhood, index, all) =>
              all.findIndex(
                (candidate) =>
                  candidate.name.localeCompare(neighborhood.name, 'pt-BR', {
                    sensitivity: 'base',
                  }) === 0,
              ) === index,
          ),
        );
      })
      .catch(() => {
        // The queue remains usable with free filters if auxiliary options fail.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleHistory = () => {
      const next = readUrlState();
      setFilters(next.filters);
      setDraftFilters(next.filters);
      setSelectedOccurrenceId(next.selectedOccurrenceId);
    };
    window.addEventListener('popstate', handleHistory);
    return () => window.removeEventListener('popstate', handleHistory);
  }, []);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      draftFilters.startDate &&
      draftFilters.endDate &&
      draftFilters.endDate < draftFilters.startDate
    ) {
      setFilterError('A data final deve ser igual ou posterior à data inicial.');
      return;
    }
    setFilterError(null);
    const next = { ...draftFilters, page: 1 };
    setFilters(next);
    setSelectedOccurrenceId(null);
    writeUrlState({ filters: next, selectedOccurrenceId: null });
  }

  function clearFilters() {
    const next = { page: 1 };
    setDraftFilters(next);
    setFilters(next);
    setFilterError(null);
    setSelectedOccurrenceId(null);
    writeUrlState({ filters: next, selectedOccurrenceId: null });
  }

  function changePage(page: number) {
    const next = { ...filters, page };
    setFilters(next);
    setDraftFilters(next);
    writeUrlState({ filters: next, selectedOccurrenceId: null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openOccurrence(occurrenceId: string) {
    setSelectedOccurrenceId(occurrenceId);
    writeUrlState({ filters, selectedOccurrenceId: occurrenceId });
  }

  function closeOccurrence() {
    setSelectedOccurrenceId(null);
    writeUrlState({ filters, selectedOccurrenceId: null }, true);
  }

  return (
    <>
      <header className="dashboard__header operations-header">
        <div>
          <span className="eyebrow">Fila municipal</span>
          <h1>Ocorrências para atendimento</h1>
          <p>Consulte, filtre e abra cada chamado dentro do escopo autorizado.</p>
        </div>
        <div className="header-actions">
          <span className="queue-total">
            <strong>{pagination.total}</strong> chamados encontrados
          </span>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void loadOccurrences(filters)}
          >
            Atualizar fila
          </button>
          <button className="text-button" type="button" onClick={() => void onLogout()}>
            Sair
          </button>
        </div>
      </header>

      <form className="operations-filters" onSubmit={applyFilters}>
        <label>
          Status
          <select
            value={draftFilters.status ?? ''}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                status: event.target.value ? (event.target.value as OccurrenceStatus) : undefined,
              }))
            }
          >
            <option value="">Todos os status</option>
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoria
          <select
            value={draftFilters.category ?? ''}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                category: event.target.value || undefined,
              }))
            }
          >
            <option value="">Todas as categorias</option>
            {categories.map((category) => (
              <option
                key={category.key ?? category.name}
                value={category.code ?? category.key ?? ''}
              >
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bairro
          <select
            value={draftFilters.neighborhood ?? ''}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                neighborhood: event.target.value || undefined,
              }))
            }
          >
            <option value="">Todos os bairros</option>
            {neighborhoods.map((neighborhood) => (
              <option key={neighborhood.name} value={neighborhood.name}>
                {neighborhood.name}
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
        <div className="filter-actions">
          <button className="primary-button" type="submit">
            Aplicar filtros
          </button>
          <button className="text-button" type="button" onClick={clearFilters}>
            Limpar
          </button>
        </div>
        {filterError && (
          <p className="filter-error" role="alert">
            {filterError}
          </p>
        )}
      </form>

      <section className="panel operations-panel" aria-busy={loading}>
        {error ? (
          <div className="dashboard-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void loadOccurrences(filters)}>
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <div className="panel-loading">Consultando a fila operacional…</div>
        ) : occurrences.length === 0 ? (
          <div className="empty-state">
            <span aria-hidden="true">◎</span>
            <strong>Nenhum chamado encontrado</strong>
            <p>Altere ou remova os filtros para ampliar a busca.</p>
          </div>
        ) : (
          <div className="operations-list">
            {occurrences.map((occurrence) => (
              <article className="operation-card" key={occurrence.id}>
                <OccurrencePhoto occurrence={occurrence} compact />
                <div className="operation-card__main">
                  <div className="operation-card__meta">
                    <span>{occurrence.protocol}</span>
                    <StatusBadge status={occurrence.status} />
                  </div>
                  <h2>{occurrence.title}</h2>
                  <p>
                    {occurrence.category?.name ?? 'Sem categoria'} · {neighborhoodName(occurrence)}
                  </p>
                </div>
                <dl className="operation-card__signals">
                  <div>
                    <dt>Prioridade</dt>
                    <dd>{occurrence.priorityScore.toFixed(1)}</dd>
                  </div>
                  <div>
                    <dt>Confirmações</dt>
                    <dd>{occurrence.confirmationCount}</dd>
                  </div>
                  <div>
                    <dt>Atualização</dt>
                    <dd>{formatDate(occurrence.updatedAt)}</dd>
                  </div>
                </dl>
                <button
                  className="secondary-button operation-card__action"
                  type="button"
                  onClick={() => openOccurrence(occurrence.id)}
                >
                  Abrir chamado
                </button>
              </article>
            ))}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <nav className="pagination" aria-label="Paginação da fila">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => changePage(pagination.page - 1)}
            >
              Anterior
            </button>
            <span>
              Página <strong>{pagination.page}</strong> de {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => changePage(pagination.page + 1)}
            >
              Próxima
            </button>
          </nav>
        )}
      </section>

      {selectedOccurrenceId && (
        <DetailPanel
          key={selectedOccurrenceId}
          occurrenceId={selectedOccurrenceId}
          onClose={closeOccurrence}
        />
      )}
    </>
  );
}
