import { useQueryClient } from '@tanstack/react-query';

import { Button } from '../components/button';
import { ServiceStatusCard } from '../components/service-status-card';
import { StatusBadge, type ServiceState } from '../components/status-badge';
import { env } from '../config/env';
import {
  healthQueryKeys,
  useApiHealth,
  useDatabaseHealth,
} from '../features/status/health-queries';
import { getSafeErrorMessage } from '../lib/api-error';

function queryState(enabled: boolean, isPending: boolean, isError: boolean): ServiceState {
  if (!enabled) return 'disabled';
  if (isPending) return 'loading';
  if (isError) return 'unavailable';
  return 'available';
}

export function StatusPage() {
  const queryClient = useQueryClient();
  const apiHealth = useApiHealth();
  const databaseHealth = useDatabaseHealth();
  const isRefreshing = apiHealth.isFetching || databaseHealth.isFetching;
  const apiState = queryState(env.enableApiStatus, apiHealth.isPending, apiHealth.isError);
  const databaseState = queryState(
    env.enableDatabaseStatus,
    databaseHealth.isPending,
    databaseHealth.isError,
  );
  const overallState: ServiceState =
    apiState === 'unavailable' || databaseState === 'unavailable'
      ? 'unavailable'
      : apiState === 'loading' || databaseState === 'loading'
        ? 'loading'
        : apiState === 'disabled' && databaseState === 'disabled'
          ? 'disabled'
          : 'available';

  const refreshAll = (): void => {
    void queryClient.invalidateQueries({ queryKey: healthQueryKeys.all });
  };

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-brand-50 to-transparent"
        aria-hidden="true"
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="rounded-[32px] border border-brand-100 bg-white/90 p-6 shadow-card backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">
                  Transparência operacional
                </p>
                <StatusBadge state={overallState} />
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-ink sm:text-5xl">
                Status dos serviços
              </h1>
              <p className="mt-4 max-w-xl leading-7 text-slate-600">
                Verificação pública dos componentes essenciais. Credenciais e detalhes internos
                nunca são exibidos.
              </p>
            </div>
            <Button
              variant="secondary"
              className="shrink-0"
              onClick={refreshAll}
              disabled={isRefreshing}
              aria-busy={isRefreshing}
            >
              {isRefreshing ? 'Atualizando…' : 'Atualizar status'}
            </Button>
          </div>

          <div className="mt-8 grid gap-3 border-t border-slate-100 pt-6 sm:grid-cols-3">
            <div className="rounded-2xl bg-canvas p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Monitorados
              </p>
              <p className="mt-1 text-2xl font-black text-ink">2 serviços</p>
            </div>
            <div className="rounded-2xl bg-canvas p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Atualização
              </p>
              <p className="mt-1 text-2xl font-black text-ink">Sob demanda</p>
            </div>
            <div className="rounded-2xl bg-canvas p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Exposição</p>
              <p className="mt-1 text-2xl font-black text-ink">Somente pública</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <ServiceStatusCard
            title="API pública"
            description="Comunicação principal entre a interface e o back-end."
            state={apiState}
            checkedAt={apiHealth.data ? Date.parse(apiHealth.data.data.timestamp) : undefined}
            detail="API respondendo normalmente."
            errorMessage={apiHealth.isError ? getSafeErrorMessage(apiHealth.error) : undefined}
            onRetry={() => void apiHealth.refetch()}
            icon={
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M4 12h4l2-6 4 12 2-6h4" />
              </svg>
            }
          />
          <ServiceStatusCard
            title="Banco de dados"
            description="Verificação agregada de disponibilidade dos dados."
            state={databaseState}
            checkedAt={databaseHealth.dataUpdatedAt || undefined}
            detail="Camada de dados respondendo normalmente."
            errorMessage={
              databaseHealth.isError ? getSafeErrorMessage(databaseHealth.error) : undefined
            }
            onRetry={() => void databaseHealth.refetch()}
            icon={
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <ellipse cx="12" cy="5" rx="7" ry="3" />
                <path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" />
              </svg>
            }
          />
        </div>

        <aside className="mt-6 flex items-start gap-4 rounded-2xl border border-brand-100 bg-brand-50 p-5 text-sm leading-6 text-brand-950">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-700 shadow-sm"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M12 3 4 6v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6Z" />
              <path d="m9 12 2 2 4-5" />
            </svg>
          </span>
          <div>
            <h2 className="font-black">Verificação segura e limitada</h2>
            <p className="mt-1">
              O resultado representa a última consulta. A interface não mostra versão do banco,
              credenciais, topologia ou qualquer informação sensível.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
