import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { AppError } from '../../shared/errors/app-error.js';

export interface WebhookSignatureInput {
  secret: string | undefined;
  rawBody: Buffer;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
  webhookIdHeader: string | undefined;
  externalEventId: string;
  toleranceSeconds: number;
  now: Date;
}

export function hashWebhookPayload(rawBody: Buffer): string {
  return createHash('sha256').update(rawBody).digest('hex');
}

export function signWebhookPayload(secret: string, timestamp: number, rawBody: Buffer): string {
  return `sha256=${createHmac('sha256', secret)
    .update(`${timestamp}.`, 'utf8')
    .update(rawBody)
    .digest('hex')}`;
}

export function verifyWebhookSignature(input: WebhookSignatureInput): void {
  if (input.secret === undefined) {
    throw new AppError(
      503,
      'WEBHOOK_NOT_CONFIGURED',
      'A integracao deste webhook nao esta configurada.',
    );
  }
  if (
    input.timestampHeader === undefined ||
    input.signatureHeader === undefined ||
    input.webhookIdHeader === undefined
  ) {
    throw new AppError(
      401,
      'WEBHOOK_SIGNATURE_REQUIRED',
      'Cabecalhos de autenticacao do webhook sao obrigatorios.',
    );
  }
  if (input.webhookIdHeader !== input.externalEventId) {
    throw new AppError(
      401,
      'WEBHOOK_ID_MISMATCH',
      'O identificador assinado nao corresponde ao evento.',
    );
  }
  if (!/^\d{10}$/u.test(input.timestampHeader)) {
    throw new AppError(401, 'INVALID_WEBHOOK_TIMESTAMP', 'Timestamp do webhook invalido.');
  }
  const timestamp = Number(input.timestampHeader);
  const nowSeconds = Math.floor(input.now.getTime() / 1_000);
  if (Math.abs(nowSeconds - timestamp) > input.toleranceSeconds) {
    throw new AppError(401, 'EXPIRED_WEBHOOK', 'O webhook esta fora da janela de tempo aceita.');
  }
  if (!/^sha256=[a-f0-9]{64}$/iu.test(input.signatureHeader)) {
    throw new AppError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Assinatura do webhook invalida.');
  }
  const expected = Buffer.from(signWebhookPayload(input.secret, timestamp, input.rawBody));
  const received = Buffer.from(input.signatureHeader.toLowerCase());
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new AppError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Assinatura do webhook invalida.');
  }
}
