import { useState } from 'react';

type PublicOccurrenceImageProps = {
  src: string | null;
  alt: string;
  className: string;
  loading?: 'eager' | 'lazy';
};

export function PublicOccurrenceImage({
  src,
  alt,
  className,
  loading = 'lazy',
}: PublicOccurrenceImageProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const unavailable = !src || failedSource === src;

  if (!unavailable) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        onError={() => setFailedSource(src)}
      />
    );
  }

  return (
    <div
      className={`${className} grid place-items-center bg-gradient-to-br from-brand-50 to-slate-100 text-brand-700`}
      role={alt ? 'img' : undefined}
      aria-label={alt ? 'Imagem pública não disponível' : undefined}
      aria-hidden={alt ? undefined : 'true'}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M4 5h16v14H4Z" />
        <path d="m5 16 4-4 3 3 2-2 5 4" />
        <circle cx="15.5" cy="9" r="1.5" />
      </svg>
    </div>
  );
}
