interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <span className="inline-flex items-center gap-2.5" role="img" aria-label="Tá na Rua!">
      <span
        className="relative grid size-10 place-items-center overflow-hidden rounded-[14px] bg-brand-700 text-white shadow-brand"
        aria-hidden="true"
      >
        <svg viewBox="0 0 28 28" className="size-6" fill="none">
          <path
            d="M14 3.5a8 8 0 0 0-8 8c0 5.8 8 13 8 13s8-7.2 8-13a8 8 0 0 0-8-8Z"
            fill="currentColor"
          />
          <path d="M9.8 15.7V10l4.2-2.4 4.2 2.4v5.7" stroke="#0969E8" strokeWidth="1.8" />
          <path d="M12.2 15.7v-3h3.6v3" stroke="#0969E8" strokeWidth="1.8" />
        </svg>
      </span>
      {!compact ? (
        <span>
          <span className="block text-lg font-black tracking-[-0.03em] text-ink">Tá na Rua!</span>
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:block">
            Cidade colaborativa
          </span>
        </span>
      ) : null}
    </span>
  );
}
