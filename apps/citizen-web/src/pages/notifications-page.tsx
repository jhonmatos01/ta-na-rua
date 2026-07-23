import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '../components/button';
import { PaginationControls } from '../components/pagination-controls';
import type { CitizenNotification } from '../features/notifications/notification-contracts';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../features/notifications/notification-queries';
import {
  notificationTypeLabels,
  notificationTypeStyles,
} from '../features/notifications/notification-presenters';
import { formatPublicDate } from '../features/occurrences/occurrence-presenters';
import { getSafeErrorMessage } from '../lib/api-error';

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const unreadOnly = searchParams.get('filtro') === 'nao-lidas';
  const page = parsePage(searchParams.get('page'));
  const query = useNotifications({ page, limit: 8, unreadOnly });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  function updateView(nextUnreadOnly: boolean, nextPage = 1) {
    setSearchParams({ filtro: nextUnreadOnly ? 'nao-lidas' : 'todas', page: String(nextPage) });
  }

  async function openNotification(notification: CitizenNotification) {
    if (notification.readAt === null) await markRead.mutateAsync(notification.id);
    if (notification.entityType === 'occurrence' && notification.entityId !== null) {
      await navigate(`/ocorrencias/${notification.entityId}`);
    }
  }

  return (
    <section className="bg-canvas py-8 sm:py-14">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <header className="grid gap-6 rounded-[2rem] border border-brand-100 bg-gradient-to-br from-white to-brand-50 p-6 shadow-card sm:grid-cols-[1fr_auto] sm:items-end sm:p-9">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">
              Central de atualizações
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-ink sm:text-5xl">
              Notificações
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-slate-600">
              Acompanhe mudanças de status, novas confirmações e pedidos de avaliação sem perder o
              contexto da ocorrência.
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={
              markAllRead.isPending ||
              !query.data?.notifications.some((item) => item.readAt === null)
            }
            onClick={() => void markAllRead.mutateAsync()}
          >
            {markAllRead.isPending ? 'Marcando...' : 'Marcar todas como lidas'}
          </Button>
        </header>

        <div
          className="mt-6 flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-card"
          role="tablist"
          aria-label="Filtros de notificações"
        >
          {(
            [
              [false, 'Todas'],
              [true, 'Não lidas'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              role="tab"
              aria-selected={unreadOnly === value}
              onClick={() => updateView(value)}
              className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-extrabold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${unreadOnly === value ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {markAllRead.isError || markRead.isError ? (
          <p
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900"
            role="alert"
          >
            {getSafeErrorMessage(markAllRead.error ?? markRead.error)}
          </p>
        ) : null}

        {query.isError ? (
          <div
            className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900"
            role="alert"
          >
            <h2 className="font-black">Não foi possível carregar as notificações.</h2>
            <p className="mt-2 text-sm">{getSafeErrorMessage(query.error)}</p>
            <Button className="mt-4" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : query.data === undefined ? (
          <div className="mt-6 space-y-3" role="status">
            <span className="sr-only">Carregando notificações</span>
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-3xl bg-slate-200/70" />
            ))}
          </div>
        ) : query.data.notifications.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-card">
            <span
              className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-2xl"
              aria-hidden="true"
            >
              ✓
            </span>
            <h2 className="mt-5 text-xl font-black text-ink">Tudo acompanhado</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {unreadOnly
                ? 'Você não tem notificações pendentes de leitura.'
                : 'Nenhuma notificação foi recebida ainda.'}
            </p>
          </div>
        ) : (
          <ol className="mt-6 space-y-3">
            {query.data.notifications.map((notification) => {
              const canOpen =
                notification.entityType === 'occurrence' && notification.entityId !== null;
              return (
                <li key={notification.id}>
                  <article
                    className={`rounded-3xl border p-5 shadow-card transition sm:p-6 ${notification.readAt === null ? 'border-brand-200 bg-white' : 'border-slate-200 bg-white/75'}`}
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className={`mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl text-lg font-black ${notificationTypeStyles[notification.type]}`}
                        aria-hidden="true"
                      >
                        {notification.readAt === null ? '•' : '✓'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${notificationTypeStyles[notification.type]}`}
                          >
                            {notificationTypeLabels[notification.type]}
                          </span>
                          <time
                            className="text-xs font-bold text-slate-500"
                            dateTime={notification.createdAt}
                          >
                            {formatPublicDate(notification.createdAt)}
                          </time>
                        </div>
                        <h2 className="mt-3 text-lg font-black text-ink">{notification.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {notification.message}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {canOpen ? (
                            <Button onClick={() => void openNotification(notification)}>
                              Ver ocorrência
                            </Button>
                          ) : null}
                          {notification.readAt === null ? (
                            <Button
                              variant="secondary"
                              disabled={markRead.isPending}
                              onClick={() => void markRead.mutateAsync(notification.id)}
                            >
                              Marcar como lida
                            </Button>
                          ) : (
                            <span className="inline-flex min-h-11 items-center text-sm font-bold text-emerald-700">
                              Lida
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        )}

        {query.data ? (
          <PaginationControls
            page={query.data.pagination.page}
            totalPages={query.data.pagination.totalPages}
            onPageChange={(nextPage) => updateView(unreadOnly, nextPage)}
            label="Paginação das notificações"
          />
        ) : null}
      </div>
    </section>
  );
}
