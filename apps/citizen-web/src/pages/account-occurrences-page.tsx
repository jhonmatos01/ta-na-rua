import { useSearchParams } from 'react-router-dom';

import { AccountOccurrenceCard } from '../components/account-occurrence-card';
import { Button } from '../components/button';
import { PaginationControls } from '../components/pagination-controls';
import {
  useConfirmedOccurrences,
  useMyOccurrences,
} from '../features/occurrences/occurrence-queries';
import { getSafeErrorMessage } from '../lib/api-error';

type ActivityTab = 'confirmed' | 'created';

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function AccountOccurrencesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: ActivityTab = searchParams.get('tab') === 'confirmed' ? 'confirmed' : 'created';
  const page = parsePage(searchParams.get('page'));
  const filters = { page, limit: 6 };
  const createdQuery = useMyOccurrences(filters);
  const confirmedQuery = useConfirmedOccurrences(filters);
  const query = tab === 'created' ? createdQuery : confirmedQuery;

  function updateView(nextTab: ActivityTab, nextPage = 1) {
    setSearchParams({ tab: nextTab, page: String(nextPage) });
  }

  const title = tab === 'created' ? 'Ocorrências criadas' : 'Ocorrências confirmadas';
  const emptyMessage =
    tab === 'created'
      ? 'Você ainda não registrou nenhuma ocorrência.'
      : 'Você ainda não confirmou nenhuma ocorrência da comunidade.';

  return (
    <section className="bg-canvas py-8 sm:py-14">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] bg-ink px-6 py-8 text-white shadow-floating sm:px-10 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-200">
                Minha participação
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                Acompanhe o que você registrou e fortaleceu.
              </h1>
              <p className="mt-4 max-w-2xl leading-7 text-slate-300">
                Status, prioridade e confirmações vêm diretamente da API e permanecem sincronizados.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <p className="text-xs font-bold text-slate-400">Exibindo agora</p>
              <p className="mt-1 text-2xl font-black">{query.data?.pagination.total ?? '—'}</p>
              <p className="text-xs text-slate-300">{title.toLocaleLowerCase('pt-BR')}</p>
            </div>
          </div>
        </header>

        <div
          className="mt-6 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-card"
          role="tablist"
          aria-label="Tipos de atividade"
        >
          {(
            [
              ['created', 'Criadas por mim'],
              ['confirmed', 'Eu também vi'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => updateView(value)}
              className={`min-h-11 flex-1 whitespace-nowrap rounded-xl px-2 text-xs font-extrabold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:px-4 sm:text-sm ${
                tab === value
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-700">
              Histórico
            </p>
            <h2 className="mt-2 text-2xl font-black text-ink sm:text-3xl">{title}</h2>
          </div>
          {query.data ? (
            <p className="text-sm font-bold text-slate-500">
              {query.data.pagination.total} no total
            </p>
          ) : null}
        </div>

        {query.isError ? (
          <div
            className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900"
            role="alert"
          >
            <h2 className="font-black">Não foi possível carregar suas atividades.</h2>
            <p className="mt-2 text-sm leading-6">{getSafeErrorMessage(query.error)}</p>
            <Button className="mt-4" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : query.data === undefined ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-2" role="status">
            <span className="sr-only">Carregando suas ocorrências</span>
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-52 animate-pulse rounded-3xl bg-slate-200/70" />
            ))}
          </div>
        ) : query.data.occurrences.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-card">
            <span
              className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-2xl"
              aria-hidden="true"
            >
              ✓
            </span>
            <h2 className="mt-5 text-xl font-black text-ink">Nada por aqui ainda</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{emptyMessage}</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {query.data.occurrences.map((occurrence) => (
              <AccountOccurrenceCard key={occurrence.id} occurrence={occurrence} relation={tab} />
            ))}
          </div>
        )}

        {query.data ? (
          <PaginationControls
            page={query.data.pagination.page}
            totalPages={query.data.pagination.totalPages}
            onPageChange={(nextPage) => updateView(tab, nextPage)}
            label={`Paginação de ${title.toLocaleLowerCase('pt-BR')}`}
          />
        ) : null}
      </div>
    </section>
  );
}
