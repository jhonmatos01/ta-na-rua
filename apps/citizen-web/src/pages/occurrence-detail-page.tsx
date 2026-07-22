import { Link, useParams } from 'react-router-dom';

import { Button } from '../components/button';
import { PublicOccurrenceImage } from '../components/public-occurrence-image';
import { resolveApiAssetUrl } from '../features/occurrences/occurrence-api';
import {
  formatPublicDate,
  getNeighborhoodLabel,
  occurrenceStatusLabels,
  riskLevelLabels,
} from '../features/occurrences/occurrence-presenters';
import {
  usePublicOccurrence,
  usePublicOccurrenceTimeline,
} from '../features/occurrences/occurrence-queries';
import { ApiError, getSafeErrorMessage } from '../lib/api-error';

function DetailLoading() {
  return (
    <section className="bg-canvas py-10" role="status">
      <span className="sr-only">Carregando detalhes da ocorrência</span>
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="h-96 animate-pulse rounded-3xl bg-slate-200" />
        <div className="h-96 animate-pulse rounded-3xl bg-white" />
      </div>
    </section>
  );
}

export function OccurrenceDetailPage() {
  const { occurrenceId } = useParams();
  const occurrenceQuery = usePublicOccurrence(occurrenceId);
  const timelineQuery = usePublicOccurrenceTimeline(occurrenceId);

  if (occurrenceQuery.isPending) return <DetailLoading />;

  if (occurrenceQuery.isError) {
    const notFound =
      occurrenceQuery.error instanceof ApiError && occurrenceQuery.error.code === 'NOT_FOUND';
    return (
      <section className="bg-canvas py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">
            {notFound ? 'Ocorrência não encontrada' : 'Detalhes indisponíveis'}
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-ink">
            {notFound
              ? 'Este registro não está disponível publicamente.'
              : 'Não foi possível abrir esta ocorrência.'}
          </h1>
          <p className="mt-4 leading-7 text-slate-600">
            {notFound
              ? 'A ocorrência pode ter sido removida, rejeitada ou ainda estar em revisão.'
              : getSafeErrorMessage(occurrenceQuery.error)}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {!notFound ? (
              <Button type="button" onClick={() => void occurrenceQuery.refetch()}>
                Tentar novamente
              </Button>
            ) : null}
            <Link
              to="/mapa"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-extrabold text-ink hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Voltar ao mapa
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const occurrence = occurrenceQuery.data;
  const images = occurrence.images
    .map((image) => ({ ...image, resolvedUrl: resolveApiAssetUrl(image.url) }))
    .filter((image) => image.resolvedUrl !== null);

  return (
    <section className="bg-canvas py-8 sm:py-12">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Link
          to="/mapa"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-extrabold text-brand-700 hover:bg-brand-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <span aria-hidden="true">←</span> Voltar ao mapa
        </Link>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
            <PublicOccurrenceImage
              src={images[0]?.resolvedUrl ?? null}
              alt={`Imagem pública da ocorrência: ${occurrence.title}`}
              className="aspect-[4/3] w-full object-cover"
              loading="eager"
            />
            {images.length > 1 ? (
              <div className="grid grid-cols-3 gap-2 p-3">
                {images.slice(1, 4).map((image, index) => (
                  <PublicOccurrenceImage
                    key={image.id}
                    src={image.resolvedUrl}
                    alt={`Imagem pública adicional ${index + 2}`}
                    className="aspect-square w-full rounded-xl object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            ) : null}
          </div>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-extrabold text-brand-700">
                {occurrenceStatusLabels[occurrence.status]}
              </span>
              <span className="text-xs font-bold text-slate-500">{occurrence.protocol}</span>
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] text-ink">
              {occurrence.title}
            </h1>
            <p className="mt-3 text-sm font-semibold text-slate-600">
              {occurrence.category?.name ?? 'Sem categoria'} · {getNeighborhoodLabel(occurrence)}
            </p>
            <p className="mt-6 leading-7 text-slate-700">
              {occurrence.description ?? 'Nenhuma descrição pública foi informada.'}
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-3">
              {[
                ['Confirmações', String(occurrence.confirmationCount)],
                ['Prioridade', Math.round(occurrence.priorityScore).toString()],
                [
                  'Risco',
                  occurrence.riskLevel ? riskLevelLabels[occurrence.riskLevel] : 'Não classificado',
                ],
                ['Atualizado', formatPublicDate(occurrence.updatedAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-canvas p-4">
                  <dt className="text-xs font-bold text-slate-500">{label}</dt>
                  <dd className="mt-1 font-black text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-700">
                Local aproximado
              </p>
              <p className="mt-2 font-bold text-ink">
                {occurrence.address ?? getNeighborhoodLabel(occurrence)}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Coordenadas arredondadas e sem número do imóvel para preservar a privacidade.
              </p>
            </div>
          </article>
        </div>

        <section
          className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8"
          aria-labelledby="timeline-title"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-700">
            Acompanhamento público
          </p>
          <h2 id="timeline-title" className="mt-2 text-3xl font-black text-ink">
            Linha do tempo
          </h2>

          {timelineQuery.isPending ? (
            <p className="mt-6 text-sm font-semibold text-slate-600" role="status">
              Carregando atualizações...
            </p>
          ) : timelineQuery.isError ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              A ocorrência foi carregada, mas a linha do tempo está temporariamente indisponível.
            </div>
          ) : timelineQuery.data.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-canvas p-4 text-sm text-slate-600">
              Ainda não há atualizações públicas para esta ocorrência.
            </p>
          ) : (
            <ol className="mt-8 space-y-0">
              {timelineQuery.data.map((item, index) => (
                <li key={item.id} className="relative grid grid-cols-[2rem_1fr] gap-4 pb-7">
                  {index < timelineQuery.data.length - 1 ? (
                    <span
                      className="absolute bottom-0 left-[0.94rem] top-8 w-px bg-slate-200"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span
                    className="relative z-10 mt-1 size-8 rounded-full border-4 border-white bg-brand-600 shadow"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="font-black text-ink">
                      {occurrenceStatusLabels[item.newStatus]}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {item.publicMessage ?? 'Status atualizado pela equipe responsável.'}
                    </p>
                    <time className="mt-2 block text-xs font-bold text-slate-400">
                      {formatPublicDate(item.createdAt)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm leading-6 text-slate-600">
          Esta visualização não publica autoria, coordenadas exatas, motivo interno ou responsável
          pela alteração. A confirmação comunitária será ativada em uma fase posterior.
        </div>
      </div>
    </section>
  );
}
