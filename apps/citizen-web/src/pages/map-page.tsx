import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '../components/button';
import { PublicOccurrenceImage } from '../components/public-occurrence-image';
import { PublicOccurrencesMap } from '../components/public-occurrences-map';
import { env } from '../config/env';
import { resolveApiAssetUrl, type OccurrenceFilters } from '../features/occurrences/occurrence-api';
import {
  occurrenceStatusSchema,
  type OccurrenceStatus,
  type PublicOccurrence,
} from '../features/occurrences/occurrence-contracts';
import {
  getNeighborhoodLabel,
  getNeighborhoodValue,
  matchesOccurrenceSearch,
  occurrenceStatusLabels,
} from '../features/occurrences/occurrence-presenters';
import {
  useOccurrenceCatalog,
  usePublicMapPoints,
  usePublicOccurrences,
} from '../features/occurrences/occurrence-queries';
import { getSafeErrorMessage } from '../lib/api-error';

const publicStatuses: OccurrenceStatus[] = [
  'PUBLISHED',
  'FORWARDED',
  'ACKNOWLEDGED',
  'UNDER_ANALYSIS',
  'SCHEDULED',
  'IN_PROGRESS',
  'RESOLVED',
  'CONTESTED',
  'CLOSED',
  'DUPLICATE',
];

const EMPTY_OCCURRENCES: PublicOccurrence[] = [];

interface MapFocus {
  latitude: number;
  longitude: number;
  zoom: number;
  requestId: number;
}

function readStatus(value: string | null): OccurrenceStatus | undefined {
  const parsed = occurrenceStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function MapPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [focus, setFocus] = useState<MapFocus>();
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const search = searchParams.get('busca') ?? '';
  const filters: OccurrenceFilters = {
    category: searchParams.get('categoria') || undefined,
    neighborhood: searchParams.get('bairro') || undefined,
    status: readStatus(searchParams.get('status')),
  };

  const catalogQuery = useOccurrenceCatalog();
  const occurrencesQuery = usePublicOccurrences(filters);
  const mapQuery = usePublicMapPoints({
    category: filters.category,
    status: filters.status,
  });

  const catalog = catalogQuery.data?.occurrences ?? EMPTY_OCCURRENCES;
  const occurrences = occurrencesQuery.data?.occurrences ?? EMPTY_OCCURRENCES;
  const visibleOccurrences = useMemo(
    () => occurrences.filter((occurrence) => matchesOccurrenceSearch(occurrence, search)),
    [occurrences, search],
  );
  const visiblePoints = useMemo(() => {
    const points = mapQuery.data ?? [];
    if (filters.neighborhood === undefined && search.trim().length === 0) return points;
    const visibleIds = new Set(visibleOccurrences.map((occurrence) => occurrence.id));
    return points.filter((point) => visibleIds.has(point.id));
  }, [filters.neighborhood, mapQuery.data, search, visibleOccurrences]);

  const categoryOptions = useMemo(() => {
    const values = new Map<string, string>();
    for (const occurrence of catalog) {
      if (occurrence.category?.name) values.set(occurrence.category.id, occurrence.category.name);
    }
    return [...values].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [catalog]);
  const neighborhoodOptions = useMemo(() => {
    const values = new Map<string, string>();
    for (const occurrence of catalog) {
      const value = getNeighborhoodValue(occurrence);
      if (value) values.set(value, getNeighborhoodLabel(occurrence));
    }
    return [...values].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [catalog]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const [parameter, field] of [
      ['busca', 'search'],
      ['categoria', 'category'],
      ['bairro', 'neighborhood'],
      ['status', 'status'],
    ] as const) {
      const rawValue = form.get(field);
      const value = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (value.length > 0) next.set(parameter, value);
    }
    setSearchParams(next);
  }

  function resetToCity() {
    setFocus({
      latitude: env.defaultMapLatitude,
      longitude: env.defaultMapLongitude,
      zoom: env.defaultMapZoom,
      requestId: Date.now(),
    });
    setLocationMessage(`Mapa centralizado em ${env.defaultMunicipalityName}.`);
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setLocationMessage('Seu navegador não oferece geolocalização. Use a busca e os filtros.');
      return;
    }
    setLocating(true);
    setLocationMessage('Solicitando sua localização ao navegador...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFocus({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          zoom: 14,
          requestId: Date.now(),
        });
        setLocating(false);
        setLocationMessage(
          'Mapa centralizado na sua posição. A localização não foi enviada à API.',
        );
      },
      () => {
        setLocating(false);
        setLocationMessage(
          'Não foi possível usar sua localização. Continue pela busca ou centralize no município.',
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const hasError = occurrencesQuery.isError || mapQuery.isError;
  const isLoading = occurrencesQuery.isPending || mapQuery.isPending;

  return (
    <section className="bg-canvas py-8 sm:py-12">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">
              Mapa público · dados reais
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">
              O que está acontecendo na cidade.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Explore ocorrências publicadas em {env.defaultMunicipalityName}. As posições e os
              endereços são aproximados para proteger quem participa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={useMyLocation} disabled={locating}>
              {locating ? 'Localizando...' : 'Usar minha localização'}
            </Button>
            <Button type="button" variant="secondary" onClick={resetToCity}>
              Centralizar no município
            </Button>
          </div>
        </header>

        {locationMessage ? (
          <p
            className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-950"
            role="status"
          >
            {locationMessage}
          </p>
        ) : null}

        <form
          key={searchParams.toString()}
          className="mt-8 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)_auto]"
          onSubmit={applyFilters}
          aria-label="Filtros do mapa"
        >
          <label className="grid gap-2 text-sm font-extrabold text-ink">
            Buscar
            <input
              name="search"
              type="search"
              defaultValue={search}
              placeholder="Título, protocolo ou bairro"
              className="min-h-12 rounded-xl border border-slate-300 px-3 font-medium outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-100"
            />
          </label>
          <label className="grid gap-2 text-sm font-extrabold text-ink">
            Categoria
            <select
              name="category"
              defaultValue={filters.category ?? ''}
              className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 font-medium outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-100"
            >
              <option value="">Todas</option>
              {filters.category &&
              !categoryOptions.some(([value]) => value === filters.category) ? (
                <option value={filters.category}>Categoria selecionada</option>
              ) : null}
              {categoryOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-extrabold text-ink">
            Status
            <select
              name="status"
              defaultValue={filters.status ?? ''}
              className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 font-medium outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-100"
            >
              <option value="">Todos</option>
              {publicStatuses.map((status) => (
                <option key={status} value={status}>
                  {occurrenceStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-extrabold text-ink">
            Bairro
            <select
              name="neighborhood"
              defaultValue={filters.neighborhood ?? ''}
              className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 font-medium outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-100"
            >
              <option value="">Todos</option>
              {filters.neighborhood &&
              !neighborhoodOptions.some(([value]) => value === filters.neighborhood) ? (
                <option value={filters.neighborhood}>Bairro selecionado</option>
              ) : null}
              {neighborhoodOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit">Aplicar</Button>
            {searchParams.size > 0 ? (
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="min-h-12 rounded-xl px-3 text-sm font-extrabold text-slate-600 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Limpar
              </button>
            ) : null}
          </div>
        </form>

        {hasError ? (
          <div
            className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900"
            role="alert"
          >
            <h2 className="text-lg font-black">Não foi possível carregar o mapa público.</h2>
            <p className="mt-2 text-sm leading-6">
              {getSafeErrorMessage(occurrencesQuery.error ?? mapQuery.error)}
            </p>
            <Button
              type="button"
              className="mt-4"
              onClick={() => {
                void occurrencesQuery.refetch();
                void mapQuery.refetch();
              }}
            >
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)]">
            <PublicOccurrencesMap
              points={visiblePoints}
              focus={focus}
              onSelect={(occurrenceId) => {
                void navigate(`/ocorrencias/${occurrenceId}`);
              }}
            />

            <aside
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-card sm:p-5"
              aria-labelledby="map-results-title"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-700">
                    Ocorrências visíveis
                  </p>
                  <h2 id="map-results-title" className="mt-2 text-2xl font-black text-ink">
                    {isLoading
                      ? 'Carregando...'
                      : `${visibleOccurrences.length} ${visibleOccurrences.length === 1 ? 'resultado' : 'resultados'}`}
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
                  Público
                </span>
              </div>

              {isLoading ? (
                <div className="mt-5 space-y-3" role="status">
                  <span className="sr-only">Carregando ocorrências</span>
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
                  ))}
                </div>
              ) : visibleOccurrences.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-canvas p-6 text-center">
                  <h3 className="font-black text-ink">Nenhuma ocorrência encontrada</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Ajuste a busca ou limpe os filtros para ampliar os resultados.
                  </p>
                </div>
              ) : (
                <ol className="mt-5 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                  {visibleOccurrences.map((occurrence) => {
                    const thumbnail = occurrence.images
                      .map((image) => resolveApiAssetUrl(image.url))
                      .find((url) => url !== null);
                    return (
                      <li key={occurrence.id}>
                        <Link
                          to={`/ocorrencias/${occurrence.id}`}
                          className="group grid min-h-32 grid-cols-[5rem_1fr] gap-4 rounded-2xl border border-slate-200 p-3 transition hover:border-brand-300 hover:bg-brand-50/40 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        >
                          <div className="grid overflow-hidden rounded-xl bg-slate-100">
                            <PublicOccurrenceImage
                              src={thumbnail ?? null}
                              alt=""
                              className="size-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-extrabold text-brand-700">
                              {occurrenceStatusLabels[occurrence.status]}
                            </span>
                            <h3 className="mt-1 line-clamp-2 font-black leading-5 text-ink group-hover:text-brand-700">
                              {occurrence.title}
                            </h3>
                            <p className="mt-2 truncate text-xs text-slate-500">
                              {getNeighborhoodLabel(occurrence)} · {occurrence.protocol}
                            </p>
                            <p className="mt-2 text-xs font-bold text-slate-600">
                              {occurrence.confirmationCount}{' '}
                              {occurrence.confirmationCount === 1 ? 'confirmação' : 'confirmações'}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </aside>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">
          A busca textual é aplicada aos resultados públicos carregados. Nenhum dado pessoal,
          coordenada exata ou localização do navegador é enviado por este mapa.
        </div>
      </div>
    </section>
  );
}
