export type ServiceState = 'available' | 'disabled' | 'loading' | 'unavailable';

const labels: Record<ServiceState, string> = {
  available: 'Disponível',
  disabled: 'Não monitorado',
  loading: 'Verificando',
  unavailable: 'Indisponível',
};

const styles: Record<ServiceState, string> = {
  available: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  disabled: 'bg-slate-100 text-slate-700 ring-slate-200',
  loading: 'bg-amber-50 text-amber-900 ring-amber-200',
  unavailable: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export function StatusBadge({ state }: { state: ServiceState }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold ring-1 ring-inset ${styles[state]}`}
    >
      <span
        className={`size-2 rounded-full ${state === 'available' ? 'bg-emerald-600' : state === 'unavailable' ? 'bg-rose-600' : state === 'loading' ? 'animate-pulse bg-amber-500' : 'bg-slate-500'}`}
        aria-hidden="true"
      />
      {labels[state]}
    </span>
  );
}
