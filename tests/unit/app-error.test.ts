import { describe, expect, it } from 'vitest';

import { AppError } from '../../src/shared/errors/app-error.js';

describe('AppError', () => {
  it('mantem codigo HTTP, codigo de negocio e detalhes seguros', () => {
    const error = new AppError(409, 'CONFLICT', 'Recurso em conflito.', {
      field: 'email',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'AppError',
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Recurso em conflito.',
      details: { field: 'email' },
    });
  });
});
