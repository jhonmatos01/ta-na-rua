import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Button } from '../components/button';
import { useAuth } from '../features/auth/auth-context';
import { getEvaluationErrorMessage } from '../features/evaluations/evaluation-errors';
import {
  useEvaluationSummary,
  useOccurrenceEvaluations,
  useSaveEvaluation,
} from '../features/evaluations/evaluation-queries';
import { occurrenceStatusLabels } from '../features/occurrences/occurrence-presenters';
import { usePublicOccurrence } from '../features/occurrences/occurrence-queries';

const scoreOptions = [1, 2, 3, 4, 5] as const;

function ScorePicker({
  label,
  name,
  optional = false,
  value,
}: {
  label: string;
  name: string;
  optional?: boolean;
  value: number | null;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-black text-ink">
        {label} {optional ? <span className="font-medium text-slate-500">(opcional)</span> : null}
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {scoreOptions.map((score) => (
          <label key={score} className="cursor-pointer">
            <input
              className="peer sr-only"
              type="radio"
              name={name}
              value={score}
              defaultChecked={value === score}
              required={!optional}
            />
            <span className="grid size-12 place-items-center rounded-xl border border-slate-300 bg-white text-lg font-black text-slate-600 transition hover:border-brand-300 peer-checked:border-brand-700 peer-checked:bg-brand-700 peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600">
              {score}
            </span>
          </label>
        ))}
        {optional ? (
          <label className="cursor-pointer">
            <input
              className="peer sr-only"
              type="radio"
              name={name}
              value=""
              defaultChecked={value === null}
            />
            <span className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-600 transition peer-checked:border-brand-700 peer-checked:bg-brand-50 peer-checked:text-brand-800 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600">
              Não informar
            </span>
          </label>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-slate-500">1 = muito ruim · 5 = excelente</p>
    </fieldset>
  );
}

export function EvaluationPage() {
  const { occurrenceId } = useParams();
  const auth = useAuth();
  const occurrenceQuery = usePublicOccurrence(occurrenceId);
  const eligibleStatus =
    occurrenceQuery.data !== undefined &&
    ['CLOSED', 'CONTESTED', 'RESOLVED'].includes(occurrenceQuery.data.status);
  const evaluationsQuery = useOccurrenceEvaluations(occurrenceId, eligibleStatus);
  const summaryQuery = useEvaluationSummary(occurrenceId, eligibleStatus);
  const ownEvaluation = useMemo(
    () => evaluationsQuery.data?.find((evaluation) => evaluation.isMine),
    [evaluationsQuery.data],
  );
  const editing = ownEvaluation !== undefined;
  const mutation = useSaveEvaluation(occurrenceId ?? '', editing);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationMessage(null);
    mutation.reset();
    const form = new FormData(event.currentTarget);
    const rating = Number(form.get('rating'));
    const resolvedValue = form.get('resolved');
    const problemResolved =
      resolvedValue === 'true' ? true : resolvedValue === 'false' ? false : null;
    const serviceQualityValue = form.get('serviceQuality');
    const serviceQuality = serviceQualityValue ? Number(serviceQualityValue) : null;
    const commentValue = form.get('comment');
    const normalizedComment = typeof commentValue === 'string' ? commentValue.trim() : '';
    if (
      !scoreOptions.includes(rating as (typeof scoreOptions)[number]) ||
      problemResolved === null
    ) {
      setValidationMessage('Informe uma nota e diga se o problema foi resolvido.');
      return;
    }
    if (normalizedComment.length > 1000) {
      setValidationMessage('O comentário pode ter no máximo 1.000 caracteres.');
      return;
    }
    mutation.mutate({
      rating,
      problemResolved,
      serviceQuality,
      comment: normalizedComment === '' ? null : normalizedComment,
    });
  }

  if (occurrenceQuery.isPending || (eligibleStatus && evaluationsQuery.isPending)) {
    return (
      <section className="bg-canvas py-16" role="status">
        <span className="sr-only">Carregando avaliação</span>
        <div className="mx-auto h-[34rem] w-full max-w-3xl animate-pulse rounded-[2rem] bg-white shadow-card" />
      </section>
    );
  }

  if (occurrenceQuery.isError || occurrenceQuery.data === undefined) {
    return (
      <section className="bg-canvas py-20">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h1 className="text-3xl font-black text-ink">Não foi possível abrir esta avaliação.</h1>
          <p className="mt-4 text-slate-600">{getEvaluationErrorMessage(occurrenceQuery.error)}</p>
          <Link
            className="mt-7 inline-flex font-extrabold text-brand-700"
            to="/minhas-ocorrencias?tab=pending"
          >
            Voltar às avaliações pendentes
          </Link>
        </div>
      </section>
    );
  }

  const occurrence = occurrenceQuery.data;
  if (!eligibleStatus) {
    return (
      <section className="bg-canvas py-16">
        <div className="mx-auto max-w-2xl px-4">
          <div className="rounded-[2rem] border border-amber-200 bg-white p-8 text-center shadow-card">
            <span
              className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-100 text-2xl"
              aria-hidden="true"
            >
              ⏳
            </span>
            <h1 className="mt-5 text-3xl font-black text-ink">Avaliação ainda não disponível</h1>
            <p className="mt-3 leading-7 text-slate-600">
              Esta ocorrência está como{' '}
              {occurrenceStatusLabels[occurrence.status].toLocaleLowerCase('pt-BR')}. A avaliação
              será liberada quando o reparo for resolvido.
            </p>
            <Link
              className="mt-7 inline-flex font-extrabold text-brand-700"
              to={`/ocorrencias/${occurrence.id}`}
            >
              Ver ocorrência
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (evaluationsQuery.isError) {
    return (
      <section className="bg-canvas py-16">
        <div className="mx-auto max-w-2xl px-4">
          <div
            className="rounded-[2rem] border border-red-200 bg-white p-8 text-center shadow-card"
            role="alert"
          >
            <h1 className="text-3xl font-black text-ink">Avaliação não permitida</h1>
            <p className="mt-3 leading-7 text-slate-600">
              {getEvaluationErrorMessage(evaluationsQuery.error)}
            </p>
            <Link
              className="mt-7 inline-flex font-extrabold text-brand-700"
              to={`/ocorrencias/${occurrence.id}`}
            >
              Voltar à ocorrência
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const summary = mutation.data?.summary ?? summaryQuery.data;

  return (
    <section className="bg-canvas py-8 sm:py-14">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
        <aside className="h-fit rounded-[2rem] bg-ink p-7 text-white shadow-floating lg:sticky lg:top-24">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-200">
            Sua experiência importa
          </p>
          <h1 className="mt-4 text-3xl font-black tracking-tight">
            {editing ? 'Edite sua avaliação' : 'Como ficou o reparo?'}
          </h1>
          <p className="mt-4 leading-7 text-slate-300">{occurrence.title}</p>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold text-slate-400">Protocolo</p>
            <p className="mt-1 font-black">{occurrence.protocol}</p>
            <p className="mt-3 text-xs font-bold text-slate-400">Status</p>
            <p className="mt-1 font-black text-emerald-300">
              {occurrenceStatusLabels[occurrence.status]}
            </p>
          </div>
          {summary && summary.total > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-white/5 p-3">
                <strong className="block text-2xl">{summary.total}</strong>
                <span className="text-xs text-slate-300">avaliações</span>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <strong className="block text-2xl">
                  {summary.averageRating?.toFixed(1) ?? '—'}
                </strong>
                <span className="text-xs text-slate-300">nota média</span>
              </div>
            </div>
          ) : null}
        </aside>

        <form
          onSubmit={submit}
          className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-card sm:p-9"
        >
          <div className="flex items-start gap-4 border-b border-slate-200 pb-6">
            <span
              className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-100 text-xl font-black text-brand-800"
              aria-hidden="true"
            >
              ★
            </span>
            <div>
              <h2 className="text-2xl font-black text-ink">Avaliação do serviço</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Sua resposta fica registrada e ajuda a verificar a qualidade da solução.
              </p>
            </div>
          </div>

          <div className="mt-7 space-y-8">
            <ScorePicker
              label="Nota geral do reparo"
              name="rating"
              value={ownEvaluation?.rating ?? null}
            />

            <fieldset>
              <legend className="text-sm font-black text-ink">O problema foi resolvido?</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    [true, 'Sim, foi resolvido', '✓'],
                    [false, 'Não, o problema continua', '!'],
                  ] as const
                ).map(([value, label, icon]) => (
                  <label key={String(value)} className="cursor-pointer">
                    <input
                      className="peer sr-only"
                      type="radio"
                      name="resolved"
                      value={String(value)}
                      defaultChecked={ownEvaluation?.problemResolved === value}
                      required
                    />
                    <span className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-300 px-4 font-extrabold text-slate-700 transition peer-checked:border-brand-700 peer-checked:bg-brand-50 peer-checked:text-brand-800 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600">
                      <span aria-hidden="true">{icon}</span>
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <ScorePicker
              label="Qualidade do atendimento"
              name="serviceQuality"
              optional
              value={ownEvaluation?.serviceQuality ?? null}
            />

            <label className="block">
              <span className="text-sm font-black text-ink">
                Comentário <span className="font-medium text-slate-500">(opcional)</span>
              </span>
              <textarea
                name="comment"
                className="mt-3 min-h-32 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-brand-600 focus:ring-3 focus:ring-brand-100"
                maxLength={1000}
                defaultValue={ownEvaluation?.comment ?? ''}
                placeholder="Conte o que melhorou ou o que ainda precisa de atenção."
              />
              <span className="mt-1 block text-right text-xs text-slate-500">
                Até 1.000 caracteres
              </span>
            </label>
          </div>

          {validationMessage || mutation.isError ? (
            <p
              className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900"
              role="alert"
            >
              {validationMessage ?? getEvaluationErrorMessage(mutation.error)}
            </p>
          ) : null}
          {mutation.isSuccess ? (
            <div
              className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"
              role="status"
            >
              <p className="font-black">
                Avaliação {editing ? 'atualizada' : 'enviada'} com sucesso.
              </p>
              <p className="mt-1 text-sm">
                {mutation.data.occurrenceContested
                  ? 'As avaliações indicaram que o problema pode continuar e a ocorrência voltou para análise.'
                  : 'Obrigado por ajudar a acompanhar a qualidade do serviço.'}
              </p>
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? 'Salvando...'
                : editing
                  ? 'Atualizar avaliação'
                  : 'Enviar avaliação'}
            </Button>
            <Link
              className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-extrabold text-slate-600 hover:bg-slate-100"
              to={`/ocorrencias/${occurrence.id}`}
            >
              Voltar à ocorrência
            </Link>
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500">
            Conta: {auth.user?.email}. A avaliação pode ser editada por até sete dias, conforme as
            regras da API.
          </p>
        </form>
      </div>
    </section>
  );
}
