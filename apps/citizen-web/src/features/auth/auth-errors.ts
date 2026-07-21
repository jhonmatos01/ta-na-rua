import { ApiError } from '../../lib/api-error';

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  USER_ALREADY_EXISTS: 'Já existe uma conta com este e-mail ou telefone.',
  INVALID_MUNICIPALITY: 'O município configurado não está disponível.',
  USER_BLOCKED: 'Esta conta está bloqueada. Procure o atendimento responsável.',
  USER_PENDING: 'Esta conta ainda aguarda liberação.',
  VALIDATION_ERROR: 'Revise os dados destacados e tente novamente.',
  REFRESH_TOKEN_REUSE_DETECTED: 'Sua sessão foi encerrada por segurança. Entre novamente.',
};

export function getAuthErrorMessage(error: unknown): string {
  const mappedMessage =
    error instanceof ApiError && error.apiCode ? messages[error.apiCode] : undefined;
  if (mappedMessage !== undefined) return mappedMessage;
  if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
    return 'Não foi possível acessar o serviço. Verifique sua conexão.';
  }
  if (error instanceof ApiError && error.code === 'TIMEOUT') {
    return 'A operação demorou mais que o esperado. Tente novamente.';
  }
  return 'Não foi possível concluir a operação. Tente novamente.';
}
