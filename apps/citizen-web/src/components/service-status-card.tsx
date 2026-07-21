import type { ReactNode } from 'react';

import { Button } from './button';
import { StatusBadge, type ServiceState } from './status-badge';

interface ServiceStatusCardProps {
  title: string;
  description: string;
  state: ServiceState;
  checkedAt?: number;
  detail?: string;
  errorMessage?: string;
  onRetry?: () => void;
  icon?: ReactNode;
}

function formatCheckedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(timestamp);
}

export function ServiceStatusCard({
  title,
  description,
  state,
  checkedAt,
  detail,
  errorMessage,
  onRetry,
  icon,
}: ServiceStatusCardProps) {
  return (
    <article
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              {icon}
            </span>
          ) : null}
          <div>
            <h2 className="text-lg font-black text-ink">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        </div>
        <StatusBadge state={state} />
      </div>

      {state === 'loading' ? (
        <div className="mt-5 space-y-2" aria-label="Carregando status">
          <span className="block h-3 w-3/4 animate-pulse rounded bg-slate-200" />
          <span className="block h-3 w-1/2 animate-pulse rounded bg-slate-100" />
        </div>
      ) : null}

      {state === 'available' ? (
        <div className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-600">
          <p className="font-bold text-slate-700">{detail ?? 'Serviço respondendo normalmente.'}</p>
          {checkedAt ? (
            <p className="mt-1 text-xs text-slate-500">
              Verificado em {formatCheckedAt(checkedAt)}
            </p>
          ) : null}
        </div>
      ) : null}

      {state === 'unavailable' ? (
        <div className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900">
          <p>{errorMessage ?? 'Não foi possível consultar este serviço.'}</p>
          {onRetry ? (
            <Button variant="secondary" className="mt-3" onClick={onRetry}>
              Tentar novamente
            </Button>
          ) : null}
        </div>
      ) : null}

      {state === 'disabled' ? (
        <p className="mt-5 text-sm text-slate-500">
          Consulta desativada pela configuração pública.
        </p>
      ) : null}
    </article>
  );
}
