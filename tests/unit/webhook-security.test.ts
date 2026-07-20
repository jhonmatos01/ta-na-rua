import { describe, expect, it } from 'vitest';

import { InMemoryWebhookRateLimiter } from '../../src/modules/webhooks/webhook-rate-limit.js';
import {
  hashWebhookPayload,
  signWebhookPayload,
  verifyWebhookSignature,
} from '../../src/modules/webhooks/webhook-security.js';

const secret = 'unit-test-webhook-secret-with-32-characters';
const now = new Date('2026-07-20T12:00:00.000Z');
const timestamp = Math.floor(now.getTime() / 1_000);
const body = Buffer.from('{"externalEventId":"evt-1"}');

describe('seguranca de webhooks', () => {
  it('valida HMAC, identificador e hash SHA-256 do corpo bruto', () => {
    expect(() =>
      verifyWebhookSignature({
        secret,
        rawBody: body,
        timestampHeader: String(timestamp),
        signatureHeader: signWebhookPayload(secret, timestamp, body),
        webhookIdHeader: 'evt-1',
        externalEventId: 'evt-1',
        toleranceSeconds: 300,
        now,
      }),
    ).not.toThrow();
    expect(hashWebhookPayload(body)).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('rejeita assinatura, identificador e timestamp invalidos', () => {
    const base = {
      secret,
      rawBody: body,
      timestampHeader: String(timestamp),
      signatureHeader: signWebhookPayload(secret, timestamp, body),
      webhookIdHeader: 'evt-1',
      externalEventId: 'evt-1',
      toleranceSeconds: 300,
      now,
    };
    expect(() =>
      verifyWebhookSignature({ ...base, signatureHeader: `sha256=${'0'.repeat(64)}` }),
    ).toThrowError(/Assinatura/u);
    expect(() => verifyWebhookSignature({ ...base, webhookIdHeader: 'evt-2' })).toThrowError(
      /identificador/u,
    );
    expect(() =>
      verifyWebhookSignature({ ...base, timestampHeader: String(timestamp - 301) }),
    ).toThrowError(/janela/u);
    expect(() => verifyWebhookSignature({ ...base, secret: undefined })).toThrowError(
      /configurada/u,
    );
  });

  it('aplica limite por janela e libera novamente apos o prazo', () => {
    let clock = now;
    const limiter = new InMemoryWebhookRateLimiter(2, 60, () => clock);
    expect(limiter.consume('TELEGRAM:ip').allowed).toBe(true);
    expect(limiter.consume('TELEGRAM:ip').allowed).toBe(true);
    expect(limiter.consume('TELEGRAM:ip')).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(limiter.consume('WHATSAPP:ip').allowed).toBe(true);
    clock = new Date(now.getTime() + 60_000);
    expect(limiter.consume('TELEGRAM:ip').allowed).toBe(true);
  });
});
