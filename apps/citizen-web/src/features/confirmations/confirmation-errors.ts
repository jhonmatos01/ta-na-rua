import { ApiError, getSafeErrorMessage } from '../../lib/api-error';

export function getConfirmationErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return getSafeErrorMessage(error);

  switch (error.apiCode) {
    case 'CONFIRMATION_ALREADY_EXISTS':
      return 'Sua confirmação já estava registrada. Atualizamos o estado da tela.';
    case 'OCCURRENCE_NOT_CONFIRMABLE':
      return 'Esta ocorrência não aceita novas confirmações no status atual.';
    case 'CONFIRMATION_NOT_FOUND':
      return 'Sua confirmação já estava removida. Atualizamos o estado da tela.';
    case 'OCCURRENCE_NOT_FOUND':
      return 'Esta ocorrência não está mais disponível.';
    default:
      return getSafeErrorMessage(error);
  }
}

export function isAlreadySynchronizedConfirmationError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ['CONFIRMATION_ALREADY_EXISTS', 'CONFIRMATION_NOT_FOUND'].includes(error.apiCode ?? '')
  );
}
