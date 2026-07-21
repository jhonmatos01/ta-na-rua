const clusters = [
  { label: '32', className: 'left-[14%] top-[20%] bg-coral-500 ring-coral-100' },
  { label: '14', className: 'left-[47%] top-[13%] bg-amber-500 ring-amber-100' },
  { label: '18', className: 'right-[15%] top-[24%] bg-brand-600 ring-brand-100' },
  { label: '9', className: 'left-[25%] bottom-[25%] bg-emerald-500 ring-emerald-100' },
  { label: '27', className: 'right-[32%] bottom-[31%] bg-coral-500 ring-coral-100' },
];

const filters = [
  { label: 'Buracos', color: 'bg-coral-500' },
  { label: 'Iluminação', color: 'bg-amber-500' },
  { label: 'Vazamentos', color: 'bg-sky-500' },
  { label: 'Calçadas', color: 'bg-emerald-500' },
];

export function CityMapPreview() {
  return (
    <figure
      className="relative mx-auto min-w-0 w-full max-w-[560px]"
      aria-labelledby="map-preview-caption"
    >
      <div
        className="absolute -inset-6 -z-10 rounded-[40px] bg-brand-100/40 blur-3xl"
        aria-hidden="true"
      />
      <div className="overflow-hidden rounded-[30px] border border-slate-200/90 bg-white shadow-floating">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-black tracking-tight text-ink">Sua cidade</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-extrabold text-emerald-800">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Em tempo real
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Prévia da jornada do cidadão</p>
          </div>
          <span
            className="grid size-10 place-items-center rounded-full border border-slate-200 text-slate-600"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
          </span>
        </div>

        <div className="px-4 pt-4">
          <div className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            Buscar endereço ou lugar
          </div>
          <div
            className="scrollbar-none mt-3 flex gap-2 overflow-hidden pb-3"
            aria-label="Categorias previstas"
          >
            {filters.map((filter) => (
              <span
                key={filter.label}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700"
              >
                <span className={`size-2 rounded-full ${filter.color}`} aria-hidden="true" />
                {filter.label}
              </span>
            ))}
          </div>
        </div>

        <div
          className="city-map-surface relative h-[290px] overflow-hidden border-y border-slate-100"
          aria-hidden="true"
        >
          <span className="absolute left-[55%] top-[52%] size-4 rounded-full border-4 border-white bg-brand-600 shadow-lg ring-8 ring-brand-200/50" />
          {clusters.map((cluster) => (
            <span
              key={`${cluster.label}-${cluster.className}`}
              className={`absolute grid size-10 place-items-center rounded-full text-xs font-black text-white shadow-lg ring-8 ${cluster.className}`}
            >
              {cluster.label}
            </span>
          ))}
          <span className="absolute bottom-4 right-4 grid size-12 place-items-center rounded-full bg-brand-600 text-white shadow-brand">
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Ocorrências próximas
              </p>
              <p className="mt-1 text-sm font-black text-ink">Visão pública e colaborativa</p>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-extrabold text-brand-700">
              Próxima fase
            </span>
          </div>
        </div>
      </div>
      <figcaption
        id="map-preview-caption"
        className="mt-4 text-center text-xs leading-5 text-slate-500"
      >
        Conceito visual. Mapa e relatos serão ativados somente nas fases correspondentes.
      </figcaption>
    </figure>
  );
}
