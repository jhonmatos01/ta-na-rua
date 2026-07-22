import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../features/auth/auth-context';
import {
  getConfirmationErrorMessage,
  isAlreadySynchronizedConfirmationError,
} from '../features/confirmations/confirmation-errors';
import {
  useConfirmationState,
  useCreateConfirmation,
  useRemoveConfirmation,
} from '../features/confirmations/confirmation-queries';
import { Button } from './button';

interface OccurrenceCommunityCardProps {
  occurrenceId: string;
  occurrenceTitle: string;
  initialConfirmationCount: number;
  initialPriorityScore: number;
}

export function OccurrenceCommunityCard({
  occurrenceId,
  occurrenceTitle,
  initialConfirmationCount,
  initialPriorityScore,
}: OccurrenceCommunityCardProps) {
  const { status, user } = useAuth();
  const authenticated = status === 'authenticated';
  const isCitizen = authenticated && user?.role === 'CITIZEN';
  const stateQuery = useConfirmationState(occurrenceId, authenticated, status !== 'loading');
  const createMutation = useCreateConfirmation(occurrenceId);
  const removeMutation = useRemoveConfirmation(occurrenceId);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [showShareFallback, setShowShareFallback] = useState(false);

  const confirmationCount = stateQuery.data?.confirmationCount ?? initialConfirmationCount;
  const priorityScore = stateQuery.data?.priorityScore ?? initialPriorityScore;
  const confirmedByMe = stateQuery.data?.confirmedByMe === true;
  const mutating = createMutation.isPending || removeMutation.isPending;
  const publicUrl = new URL(`/ocorrencias/${occurrenceId}`, window.location.origin).toString();

  async function synchronizeAfterConflict(error: unknown): Promise<void> {
    if (isAlreadySynchronizedConfirmationError(error)) await stateQuery.refetch();
  }

  async function toggleConfirmation(): Promise<void> {
    setActionMessage(null);
    try {
      if (confirmedByMe) {
        await removeMutation.mutateAsync();
        setActionMessage('Sua confirmação foi removida e o contador foi atualizado.');
      } else {
        await createMutation.mutateAsync();
        setActionMessage(
          'Confirmação registrada. Sua participação aumenta a relevância do problema.',
        );
      }
    } catch (error) {
      await synchronizeAfterConflict(error);
      setActionMessage(getConfirmationErrorMessage(error));
    }
  }

  async function shareOccurrence(): Promise<void> {
    setShareMessage(null);
    setShowShareFallback(false);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: occurrenceTitle,
          text: `Veja esta ocorrência no Tá na Rua!: ${occurrenceTitle}`,
          url: publicUrl,
        });
        setShareMessage('Compartilhamento aberto com segurança.');
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicUrl);
        setShareMessage('Link público copiado.');
        return;
      }
      setShowShareFallback(true);
      setShareMessage('Copie o link público exibido abaixo.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShowShareFallback(true);
      setShareMessage('Não foi possível abrir o compartilhamento. Copie o link abaixo.');
    }
  }

  return (
    <section
      className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8"
      aria-labelledby="community-title"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-700">
            Participação comunitária
          </p>
          <h2 id="community-title" className="mt-2 text-3xl font-black text-ink">
            Você também viu este problema?
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Cada confirmação ajuda a equipe pública a compreender a relevância da ocorrência. A
            confirmação não publica seu nome.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div className="min-w-32 rounded-2xl bg-brand-50 p-4 text-center">
            <dt className="text-xs font-bold text-brand-700">Confirmações</dt>
            <dd className="mt-1 text-2xl font-black text-brand-800">{confirmationCount}</dd>
          </div>
          <div className="min-w-32 rounded-2xl bg-canvas p-4 text-center">
            <dt className="text-xs font-bold text-slate-500">Prioridade</dt>
            <dd className="mt-1 text-2xl font-black text-ink">{Math.round(priorityScore)}</dd>
          </div>
        </dl>
      </div>

      {stateQuery.isError ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>Não foi possível sincronizar sua confirmação agora.</p>
          <Button
            variant="secondary"
            className="mt-3"
            type="button"
            onClick={() => void stateQuery.refetch()}
          >
            Tentar atualizar
          </Button>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {status === 'loading' ? (
          <Button type="button" disabled>
            Verificando sua sessão...
          </Button>
        ) : status === 'anonymous' ? (
          <Link
            to="/entrar"
            state={{ from: `/ocorrencias/${occurrenceId}` }}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Entre para confirmar
          </Link>
        ) : isCitizen ? (
          <Button
            type="button"
            variant={confirmedByMe ? 'secondary' : 'primary'}
            disabled={mutating || stateQuery.isError}
            aria-pressed={confirmedByMe}
            onClick={() => void toggleConfirmation()}
          >
            {mutating
              ? 'Atualizando...'
              : confirmedByMe
                ? 'Desfazer minha confirmação'
                : 'Eu também vi'}
          </Button>
        ) : (
          <p className="rounded-xl bg-canvas px-4 py-3 text-sm font-semibold text-slate-600">
            A confirmação comunitária está disponível somente para contas de cidadão.
          </p>
        )}

        <Button type="button" variant="secondary" onClick={() => void shareOccurrence()}>
          Compartilhar ocorrência
        </Button>
      </div>

      {actionMessage ? (
        <p className="mt-4 text-sm font-semibold text-slate-700" role="status" aria-live="polite">
          {actionMessage}
        </p>
      ) : null}
      {shareMessage ? (
        <p className="mt-4 text-sm font-semibold text-slate-700" role="status" aria-live="polite">
          {shareMessage}
        </p>
      ) : null}
      {showShareFallback ? (
        <label className="mt-3 block text-sm font-bold text-slate-700">
          Link público
          <input
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
            value={publicUrl}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      ) : null}
    </section>
  );
}
