import { ApiError, getSafeErrorMessage } from '../../lib/api-error';

const reportApiMessages: Record<string, string> = {
  IMAGE_REQUIRED: 'Adicione uma foto antes de enviar.',
  IMAGE_TOO_LARGE: 'A foto ultrapassa o tamanho permitido. Escolha uma imagem menor.',
  INVALID_IMAGE_TYPE: 'A foto precisa estar nos formatos JPEG, PNG ou WebP.',
  MIME_TYPE_MISMATCH: 'O conteúdo da foto não corresponde ao formato informado.',
  LOCATION_OUTSIDE_MUNICIPALITY:
    'O ponto selecionado parece estar fora do município. Corrija a localização no mapa.',
  INVALID_MUNICIPALITY: 'O município configurado não está disponível para novos registros.',
  INVALID_NEIGHBORHOOD: 'O bairro informado não pertence ao município configurado.',
  INVALID_CATEGORY: 'A categoria selecionada não está mais disponível.',
};

export function getReportErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.apiCode) {
    const message = reportApiMessages[error.apiCode];
    if (message !== undefined) return message;
  }
  return getSafeErrorMessage(error);
}

export function getConfirmationErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.apiCode === 'CONFIRMATION_ALREADY_EXISTS') {
    return 'Você já confirmou este problema. O registro existente continua válido.';
  }
  if (error instanceof ApiError && error.code === 'CONFLICT') {
    return 'Não foi possível repetir esta confirmação porque ela já está registrada.';
  }
  return getSafeErrorMessage(error);
}
