import { Writable } from 'node:stream';

import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { loggerOptions } from '../../src/config/logger.js';

interface LoggedRecord {
  password: string;
  refreshToken: string;
  req: {
    headers: {
      authorization: string;
      'x-ai-service-secret': string;
      'x-webhook-signature': string;
      'x-webhook-secret': string;
    };
  };
}

describe('logger', () => {
  it('remove credenciais e tokens dos logs', () => {
    const entries: string[] = [];
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        entries.push(chunk.toString('utf8'));
        callback();
      },
    });
    const testLogger = pino({ ...loggerOptions, level: 'info' }, destination);

    testLogger.info({
      password: 'senha-real',
      refreshToken: 'token-real',
      req: {
        headers: {
          authorization: 'Bearer segredo',
          'x-ai-service-secret': 'segredo-interno-da-ia',
          'x-webhook-signature': 'sha256=assinatura-real',
          'x-webhook-secret': 'segredo-real-do-webhook',
        },
      },
    });

    const record = JSON.parse(entries[0] ?? '{}') as LoggedRecord;
    expect(record.password).toBe('[REDACTED]');
    expect(record.refreshToken).toBe('[REDACTED]');
    expect(record.req.headers.authorization).toBe('[REDACTED]');
    expect(record.req.headers['x-ai-service-secret']).toBe('[REDACTED]');
    expect(record.req.headers['x-webhook-signature']).toBe('[REDACTED]');
    expect(record.req.headers['x-webhook-secret']).toBe('[REDACTED]');
  });
});
