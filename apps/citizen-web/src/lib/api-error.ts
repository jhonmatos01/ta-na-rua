export type ApiErrorCode =
  | 'ABORTED'
  | 'BAD_REQUEST'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'INVALID_RESPONSE'
  | 'NETWORK_ERROR'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

interface ApiErrorOptions {
  code: ApiErrorCode;
  message: string;
  status?: number;
  requestId?: string;
  details?: unknown;
  apiCode?: string;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly requestId?: string;
  readonly details?: unknown;
  readonly apiCode?: string;

  constructor({ code, message, status, requestId, details, apiCode, cause }: ApiErrorOptions) {
    super(message, { cause });
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
    this.apiCode = apiCode;
  }
}

export function getSafeErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Não foi possível concluir a consulta. Tente novamente.';
  }

  switch (error.code) {
    case 'TIMEOUT':
      return 'A consulta demorou mais que o esperado. Tente novamente.';
    case 'NETWORK_ERROR':
      return 'Não foi possível acessar o serviço. Verifique sua conexão.';
    case 'ABORTED':
      return 'A consulta foi cancelada.';
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
      return 'Você não tem permissão para acessar este recurso.';
    case 'CONFLICT':
      return 'Os dados informados entram em conflito com um registro existente.';
    case 'NOT_FOUND':
      return 'O recurso solicitado não foi encontrado.';
    default:
      return 'O serviço está temporariamente indisponível. Tente novamente.';
  }
}
