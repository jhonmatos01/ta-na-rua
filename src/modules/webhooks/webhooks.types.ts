import type { RequestContext } from '../auth/auth.types.js';
import type { WebhookInput } from './webhooks.schemas.js';

export type WebhookProvider = 'TELEGRAM' | 'WHATSAPP' | 'STATUS' | 'N8N';
export type WebhookEventStatus = 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'IGNORED';

export interface WebhookEventRecord {
  id: string;
  provider: WebhookProvider;
  externalEventId: string;
  eventType: string;
  payloadHash: string;
  status: WebhookEventStatus;
  responseCode: number | null;
  errorMessage: string | null;
  receivedAt: Date;
  processedAt: Date | null;
}

export type WebhookClaimResult =
  | { kind: 'claimed'; event: WebhookEventRecord }
  | { kind: 'duplicate'; event: WebhookEventRecord }
  | { kind: 'payload_mismatch'; event: WebhookEventRecord };

export type WebhookProcessingEffect =
  | {
      kind: 'enqueue';
      eventType: string;
      payload: Record<string, unknown>;
    }
  | {
      kind: 'record_only';
      outcome: string;
    }
  | {
      kind: 'outbox_callback';
      outboxEventId: string;
      deliveryStatus: 'PROCESSED' | 'FAILED';
      errorMessage: string | null;
    };

export interface WebhooksRepository {
  claim(
    provider: WebhookProvider,
    externalEventId: string,
    eventType: string,
    payloadHash: string,
    now: Date,
  ): Promise<WebhookClaimResult>;
  complete(
    event: WebhookEventRecord,
    effect: WebhookProcessingEffect,
    context: RequestContext,
    now: Date,
  ): Promise<string | null>;
  fail(eventId: string, responseCode: number, errorCode: string, now: Date): Promise<void>;
}

export interface WebhookRequestData extends RequestContext {
  rawBody: Buffer;
  signature: string | undefined;
  timestamp: string | undefined;
  webhookId: string | undefined;
}

export interface WebhookHandleResult {
  accepted: boolean;
  duplicate: boolean;
  webhookEventId: string;
  status: WebhookEventStatus;
  outboxEventId: string | null;
}

export interface WebhooksService {
  handle(
    provider: WebhookProvider,
    input: WebhookInput,
    request: WebhookRequestData,
  ): Promise<WebhookHandleResult>;
}

export class WebhookTargetNotFoundError extends Error {
  public constructor() {
    super('Evento de outbox nao encontrado.');
    this.name = 'WebhookTargetNotFoundError';
  }
}
