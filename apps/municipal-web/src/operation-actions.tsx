import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  assignOccurrence,
  deleteOccurrence,
  getStatusCapabilities,
  listActiveDepartments,
  listOccurrences,
  transitionOccurrenceStatus,
  type Department,
  type OccurrenceStatus,
  type OperationalOccurrence,
  type StatusActionField,
  type StatusCapabilities,
} from './api';

const actionLabels: Record<OccurrenceStatus, string> = {
  PENDING_REVIEW: 'Reabrir para revisão',
  PUBLISHED: 'Publicar ocorrência',
  FORWARDED: 'Encaminhar para equipe',
  ACKNOWLEDGED: 'Confirmar recebimento',
  UNDER_ANALYSIS: 'Colocar em análise',
  SCHEDULED: 'Agendar atendimento',
  IN_PROGRESS: 'Iniciar atendimento',
  RESOLVED: 'Marcar como resolvida',
  CONTESTED: 'Contestar resolução',
  CLOSED: 'Encerrar ocorrência',
  REJECTED: 'Rejeitar ocorrência',
  DUPLICATE: 'Marcar como duplicada',
};

function fieldValue(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function dateTimeValue(form: FormData, name: string): string | undefined {
  const value = fieldValue(form, name);
  return value ? new Date(value).toISOString() : undefined;
}

function mutationError(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'Não foi possível concluir a ação.';
}

export function OperationActions({
  occurrence,
  onChanged,
  onDeleted,
}: {
  occurrence: OperationalOccurrence;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [capabilities, setCapabilities] = useState<StatusCapabilities | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [duplicateTargets, setDuplicateTargets] = useState<OperationalOccurrence[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<OccurrenceStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [mutation, setMutation] = useState<'assignment' | 'delete' | 'status' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');

  const loadCapabilities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCapabilities, nextDepartments, occurrences] = await Promise.all([
        getStatusCapabilities(occurrence.id),
        listActiveDepartments(),
        listOccurrences({ page: 1, limit: 100 }),
      ]);
      setCapabilities(nextCapabilities);
      setDepartments(
        nextDepartments.filter(
          (department) => department.municipalityId === nextCapabilities.occurrence.municipalityId,
        ),
      );
      setDuplicateTargets(
        occurrences.occurrences.filter(
          (candidate) =>
            candidate.id !== occurrence.id &&
            candidate.municipality.id === nextCapabilities.occurrence.municipalityId &&
            !['CLOSED', 'DUPLICATE', 'REJECTED'].includes(candidate.status),
        ),
      );
      setSelectedStatus((current) =>
        nextCapabilities.actions.some((action) => action.status === current)
          ? current
          : (nextCapabilities.actions[0]?.status ?? ''),
      );
    } catch (caught) {
      setError(mutationError(caught));
    } finally {
      setLoading(false);
    }
  }, [occurrence.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCapabilities(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCapabilities]);

  const selectedAction = useMemo(
    () => capabilities?.actions.find((action) => action.status === selectedStatus) ?? null,
    [capabilities, selectedStatus],
  );

  function requires(field: StatusActionField): boolean {
    return selectedAction?.requiredFields.includes(field) ?? false;
  }

  async function submitStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAction) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setMutation('status');
    setError(null);
    setSuccess(null);
    try {
      await transitionOccurrenceStatus(occurrence.id, {
        status: selectedAction.status,
        reason: fieldValue(form, 'reason'),
        publicMessage: fieldValue(form, 'publicMessage'),
        departmentId: fieldValue(form, 'departmentId'),
        expectedResolutionAt: dateTimeValue(form, 'expectedResolutionAt'),
        scheduledFor: dateTimeValue(form, 'scheduledFor'),
        resolutionDescription: fieldValue(form, 'resolutionDescription'),
        duplicateOfOccurrenceId: fieldValue(form, 'duplicateOfOccurrenceId'),
      });
      formElement.reset();
      setSuccess(`Ação concluída: ${actionLabels[selectedAction.status]}.`);
      await loadCapabilities();
      onChanged();
    } catch (caught) {
      setError(mutationError(caught));
    } finally {
      setMutation(null);
    }
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const departmentId = fieldValue(form, 'assignmentDepartmentId');
    if (!departmentId) return;
    setMutation('assignment');
    setError(null);
    setSuccess(null);
    try {
      await assignOccurrence(occurrence.id, {
        departmentId,
        expectedResolutionAt: dateTimeValue(form, 'assignmentExpectedResolutionAt'),
        reason: fieldValue(form, 'assignmentReason'),
        publicMessage: fieldValue(form, 'assignmentPublicMessage'),
      });
      setSuccess('Equipe responsável atualizada.');
      await loadCapabilities();
      onChanged();
    } catch (caught) {
      setError(mutationError(caught));
    } finally {
      setMutation(null);
    }
  }

  async function confirmLogicalDelete() {
    if (deletePhrase !== 'EXCLUIR') return;
    setMutation('delete');
    setError(null);
    setSuccess(null);
    try {
      await deleteOccurrence(occurrence.id);
      onDeleted();
    } catch (caught) {
      setError(mutationError(caught));
      setMutation(null);
    }
  }

  if (loading && capabilities === null) {
    return <div className="operations-actions__loading">Consultando ações permitidas…</div>;
  }

  return (
    <section className="operations-actions" aria-labelledby="operations-actions-title">
      <div className="section-heading">
        <span className="eyebrow">Ações autorizadas</span>
        <h4 id="operations-actions-title">Operação do chamado</h4>
        <p>As opções abaixo são calculadas pelo back-end para seu perfil e o estado atual.</p>
      </div>

      {error && (
        <div className="action-message action-message--error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="action-message action-message--success" role="status">
          {success}
        </div>
      )}

      {capabilities?.actions.length ? (
        <form className="action-form" onSubmit={(event) => void submitStatus(event)}>
          <label>
            Próxima ação
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as OccurrenceStatus)}
            >
              {capabilities.actions.map((action) => (
                <option key={action.status} value={action.status}>
                  {actionLabels[action.status]}
                </option>
              ))}
            </select>
          </label>

          {requires('departmentId') && (
            <label>
              Equipe responsável
              <select name="departmentId" required defaultValue="">
                <option value="" disabled>
                  Selecione uma equipe
                </option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {requires('expectedResolutionAt') && (
            <label>
              Previsão de resolução
              <input name="expectedResolutionAt" type="datetime-local" required />
            </label>
          )}

          {requires('scheduledFor') && (
            <label>
              Data do atendimento
              <input name="scheduledFor" type="datetime-local" required />
            </label>
          )}

          {requires('duplicateOfOccurrenceId') && (
            <label>
              Ocorrência principal
              <select name="duplicateOfOccurrenceId" required defaultValue="">
                <option value="" disabled>
                  Selecione o chamado principal
                </option>
                {duplicateTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.protocol} — {target.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          {requires('resolutionDescription') && (
            <label className="action-form__wide">
              Solução executada
              <textarea
                name="resolutionDescription"
                rows={3}
                minLength={3}
                maxLength={2000}
                required
              />
            </label>
          )}

          {requires('reason') && (
            <label className="action-form__wide">
              Motivo interno
              <textarea name="reason" rows={3} maxLength={2000} required />
            </label>
          )}

          <label className="action-form__wide">
            Mensagem pública <small>(opcional)</small>
            <textarea name="publicMessage" rows={3} maxLength={2000} />
          </label>

          <button
            className="primary-button action-form__wide"
            type="submit"
            disabled={mutation !== null}
          >
            {mutation === 'status' ? 'Salvando…' : 'Confirmar ação'}
          </button>
        </form>
      ) : (
        <p className="operations-actions__empty">
          Não há transições de status disponíveis para este perfil.
        </p>
      )}

      {capabilities?.canAssign && (
        <details className="assignment-box">
          <summary>Atribuir ou trocar equipe</summary>
          <form className="action-form" onSubmit={(event) => void submitAssignment(event)}>
            <label>
              Equipe responsável
              <select name="assignmentDepartmentId" required defaultValue="">
                <option value="" disabled>
                  Selecione uma equipe
                </option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nova previsão <small>(opcional)</small>
              <input name="assignmentExpectedResolutionAt" type="datetime-local" />
            </label>
            <label className="action-form__wide">
              Motivo interno <small>(opcional)</small>
              <textarea name="assignmentReason" rows={2} maxLength={2000} />
            </label>
            <label className="action-form__wide">
              Mensagem pública <small>(opcional)</small>
              <textarea name="assignmentPublicMessage" rows={2} maxLength={2000} />
            </label>
            <button
              className="secondary-button action-form__wide"
              type="submit"
              disabled={mutation !== null || departments.length === 0}
            >
              {mutation === 'assignment' ? 'Atribuindo…' : 'Salvar equipe'}
            </button>
          </form>
        </details>
      )}

      {capabilities?.canDelete && (
        <div className="danger-zone">
          <div>
            <strong>Excluir logicamente</strong>
            <p>O chamado sai das filas, mas sua auditoria permanece preservada.</p>
          </div>
          {!confirmDelete ? (
            <button className="danger-button" type="button" onClick={() => setConfirmDelete(true)}>
              Excluir chamado
            </button>
          ) : (
            <div className="danger-confirm">
              <label>
                Digite <strong>EXCLUIR</strong> para confirmar
                <input
                  value={deletePhrase}
                  onChange={(event) => setDeletePhrase(event.target.value)}
                  autoComplete="off"
                />
              </label>
              <div>
                <button
                  className="danger-button"
                  type="button"
                  disabled={deletePhrase !== 'EXCLUIR' || mutation !== null}
                  onClick={() => void confirmLogicalDelete()}
                >
                  {mutation === 'delete' ? 'Excluindo…' : 'Confirmar exclusão'}
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeletePhrase('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
