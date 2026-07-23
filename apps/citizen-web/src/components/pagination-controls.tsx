interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label: string;
}

export function PaginationControls({
  page,
  totalPages,
  onPageChange,
  label,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-8 flex items-center justify-between gap-4" aria-label={label}>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-45"
      >
        Anterior
      </button>
      <p className="text-sm font-bold text-slate-600" aria-live="polite">
        Página <span className="text-ink">{page}</span> de{' '}
        <span className="text-ink">{totalPages}</span>
      </p>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-45"
      >
        Próxima
      </button>
    </nav>
  );
}
