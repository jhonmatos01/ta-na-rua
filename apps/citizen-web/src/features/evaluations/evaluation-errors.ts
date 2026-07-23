import { ApiError, getSafeErrorMessage } from '../../lib/api-error';

const messages: Record<string, string> = {
  OCCURRENCE_NOT_EVALUABLE: 'Este reparo ainda não está disponível para avaliação.',
  OCCURRENCE_RELATION_REQUIRED:
    'Somente quem criou, reportou ou confirmou esta ocorrência pode avaliar o reparo.',
  EVALUATION_ALREADY_EXISTS: 'Sua avaliação já existe. Recarregue a página para editá-la.',
  EVALUATION_EDIT_WINDOW_EXPIRED: 'O prazo de sete dias para editar esta avaliação terminou.',
  EVALUATION_NOT_EDITABLE_FOR_STATUS: 'O estado atual da ocorrência não permite esta edição.',
  EVALUATION_NOT_FOUND: 'Sua avaliação não foi encontrada.',
  EVALUATIONS_FORBIDDEN: 'Você não tem permissão para consultar as avaliações desta ocorrência.',
};

export function getEvaluationErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.apiCode) {
    const message = messages[error.apiCode];
    if (message) return message;
  }
  return getSafeErrorMessage(error);
}
