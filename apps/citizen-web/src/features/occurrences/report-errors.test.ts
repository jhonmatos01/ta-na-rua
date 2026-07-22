import { describe, expect, it } from 'vitest';

import { ApiError } from '../../lib/api-error';
import { getConfirmationErrorMessage, getReportErrorMessage } from './report-errors';

function apiError(code: 'BAD_REQUEST' | 'CONFLICT' | 'NETWORK_ERROR', apiCode?: string) {
  return new ApiError({ code, apiCode, message: 'mensagem interna' });
}

describe('report error messages', () => {
  it('traduz códigos de imagem e localização sem expor a mensagem interna', () => {
    expect(getReportErrorMessage(apiError('BAD_REQUEST', 'IMAGE_TOO_LARGE'))).toMatch(
      /imagem menor/i,
    );
    expect(getReportErrorMessage(apiError('BAD_REQUEST', 'LOCATION_OUTSIDE_MUNICIPALITY'))).toMatch(
      /corrija a localização/i,
    );
  });

  it('usa a mensagem segura para código desconhecido e falha de rede', () => {
    expect(getReportErrorMessage(apiError('NETWORK_ERROR', 'UNKNOWN_CODE'))).toMatch(
      /verifique sua conexão/i,
    );
    expect(getReportErrorMessage(new Error('segredo técnico'))).not.toContain('segredo técnico');
  });

  it('explica confirmação repetida e preserva fallback seguro', () => {
    expect(
      getConfirmationErrorMessage(apiError('CONFLICT', 'CONFIRMATION_ALREADY_EXISTS')),
    ).toMatch(/já confirmou/i);
    expect(getConfirmationErrorMessage(apiError('CONFLICT'))).toMatch(/já está registrada/i);
    expect(getConfirmationErrorMessage(apiError('NETWORK_ERROR'))).toMatch(/conexão/i);
  });
});
