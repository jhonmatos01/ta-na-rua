import { Link } from 'react-router-dom';

import type { AccountOccurrence } from '../features/occurrences/occurrence-contracts';
import {
  formatPublicDate,
  getNeighborhoodLabel,
  occurrenceStatusLabels,
} from '../features/occurrences/occurrence-presenters';
import { resolveApiAssetUrl } from '../features/occurrences/occurrence-api';
import { PublicOccurrenceImage } from './public-occurrence-image';

interface AccountOccurrenceCardProps {
  occurrence: AccountOccurrence;
  relation: 'confirmed' | 'created';
}

export function AccountOccurrenceCard({ occurrence, relation }: AccountOccurrenceCardProps) {
  const imageUrl = occurrence.images
    .map((image) => resolveApiAssetUrl(image.url))
    .find((value) => value !== null);

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-floating">
      <Link
        to={`/ocorrencias/${occurrence.id}`}
        className="grid min-h-full sm:grid-cols-[10rem_1fr] focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-brand-600"
      >
        <div className="min-h-40 bg-slate-100 sm:min-h-full">
          <PublicOccurrenceImage
            src={imageUrl ?? null}
            alt=""
            className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </div>
        <div className="flex min-w-0 flex-col p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-extrabold text-brand-700">
              {occurrenceStatusLabels[occurrence.status]}
            </span>
            <span className="text-xs font-bold text-slate-500">{occurrence.protocol}</span>
          </div>
          <h2 className="mt-4 line-clamp-2 text-xl font-black leading-tight text-ink group-hover:text-brand-700">
            {occurrence.title}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {getNeighborhoodLabel(occurrence)} · {formatPublicDate(occurrence.createdAt)}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-5 text-xs font-bold text-slate-600">
            <span>{occurrence.confirmationCount} confirmações</span>
            <span>Prioridade {Math.round(occurrence.priorityScore)}</span>
            <span className={relation === 'created' ? 'text-brand-700' : 'text-emerald-700'}>
              {relation === 'created' ? 'Criada por você' : 'Confirmada por você'}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
