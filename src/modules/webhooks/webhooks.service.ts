import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { WebhookInput } from './webhooks.schemas.js';
import { InMemoryWebhookRateLimiter } from './webhook-rate-limit.js';
import { hashWebhookPayload, verifyWebhookSignature } from './webhook-security.js';
import type {
  WebhookHandleResult,
  WebhookProcessingEffect,
  WebhookProvider,
  WebhookRequestData,
  WebhooksRepository,
  WebhooksService,
} from './webhooks.types.js';
import { WebhookTargetNotFoundError } from './webhooks.types.js';

export interface WebhookSecrets {
  TELEGRAM: string | undefined;
  WHATSAPP: string | undefined;
  STATUS: string | undefined;
  N8N: string | undefined;
}

export class DefaultWebhooksService implements WebhooksService {
  public constructor(
    private readonly repository: WebhooksRepository,
    private readonly secrets: WebhookSecrets = {
      TELEGRAM: env.TELEGRAM_WEBHOOK_SECRET,
      WHATSAPP: env.WHATSAPP_WEBHOOK_SECRET,
      STATUS: env.N8N_WEBHOOK_SECRET,
      N8N: env.N8N_WEBHOOK_SECRET,
    },
    private readonly rateLimiter = new InMemoryWebhookRateLimiter(
      env.WEBHOOK_RATE_LIMIT_MAX,
      env.WEBHOOK_RATE_LIMIT_WINDOW_SECONDS,
    ),
    private readonly now: () => Date = () => new Date(),
    private readonly timestampToleranceSeconds = env.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
  ) {}

  public async handle(
    provider: WebhookProvider,
    input: WebhookInput,
    request: WebhookRequestData,
  ): Promise<WebhookHandleResult> {
    const limited = this.rateLimiter.consume(`${provider}:${request.ipAddress ?? 'unknown'}`);
    if (!limited.allowed) {
      throw new AppError(429, 'WEBHOOK_RATE_LIMITED', 'Limite de webhooks excedido.', {
        retryAfterSeconds: limited.retryAfterSeconds,
      });
    }

    const now = this.now();
    verifyWebhookSignature({
      secret: this.secrets[provider],
      rawBody: request.rawBody,
      timestampHeader: request.timestamp,
      signatureHeader: request.signature,
      webhookIdHeader: request.webhookId,
      externalEventId: input.externalEventId,
      toleranceSeconds: this.timestampToleranceSeconds,
      now,
    });
    const claim = await this.repository.claim(
      provider,
      input.externalEventId,
      input.eventType,
      hashWebhookPayload(request.rawBody),
      now,
    );
    if (claim.kind === 'payload_mismatch') {
      throw new AppError(
        409,
        'WEBHOOK_EVENT_CONFLICT',
        'O identificador externo ja foi usado com outro payload.',
      );
    }
    if (claim.kind === 'duplicate') {
      return {
        accepted: true,
        duplicate: true,
        webhookEventId: claim.event.id,
        status: claim.event.status,
        outboxEventId: null,
      };
    }

    try {
      const outboxEventId = await this.repository.complete(
        claim.event,
        this.processingEffect(provider, input, claim.event.id),
        { ipAddress: request.ipAddress, userAgent: request.userAgent },
        now,
      );
      return {
        accepted: true,
        duplicate: false,
        webhookEventId: claim.event.id,
        status: 'PROCESSED',
        outboxEventId,
      };
    } catch (error) {
      if (!(error instanceof WebhookTargetNotFoundError)) {
        logger.error(
          { err: error, webhookEventId: claim.event.id, provider },
          'Falha interna ao concluir o processamento do webhook.',
        );
      }
      const statusCode = error instanceof WebhookTargetNotFoundError ? 404 : 503;
      const errorCode =
        error instanceof WebhookTargetNotFoundError
          ? 'OUTBOX_EVENT_NOT_FOUND'
          : 'WEBHOOK_PROCESSING_FAILED';
      try {
        await this.repository.fail(claim.event.id, statusCode, errorCode, now);
      } catch (failure) {
        logger.error(
          { err: failure, webhookEventId: claim.event.id },
          'Falha ao registrar erro de processamento do webhook.',
        );
      }
      if (error instanceof WebhookTargetNotFoundError) {
        throw new AppError(404, errorCode, 'Evento de outbox nao encontrado.');
      }
      throw new AppError(503, errorCode, 'Nao foi possivel processar o webhook neste momento.');
    }
  }

  private processingEffect(
    provider: WebhookProvider,
    input: WebhookInput,
    webhookEventId: string,
  ): WebhookProcessingEffect {
    if (provider === 'TELEGRAM' || provider === 'WHATSAPP') {
      if (input.eventType !== 'REPORT_RECEIVED') this.providerMismatch();
      const report = input;
      return {
        kind: 'enqueue',
        eventType: `${provider}_REPORT_RECEIVED`,
        payload: {
          webhookEventId,
          source: provider,
          occurredAt: report.occurredAt.toISOString(),
          report: report.data,
        },
      };
    }
    if (provider === 'STATUS') {
      if (input.eventType !== 'OCCURRENCE_STATUS_UPDATE') this.providerMismatch();
      const status = input;
      return {
        kind: 'record_only',
        outcome: `STATUS_UPDATE_RECORDED:${status.data.occurrenceId}:${status.data.status}`,
      };
    }
    if (input.eventType !== 'OUTBOX_DELIVERY_CALLBACK') this.providerMismatch();
    const callback = input;
    return {
      kind: 'outbox_callback',
      outboxEventId: callback.data.outboxEventId,
      deliveryStatus: callback.data.deliveryStatus,
      errorMessage: callback.data.errorMessage ?? null,
    };
  }

  private providerMismatch(): never {
    throw new AppError(
      422,
      'WEBHOOK_PROVIDER_EVENT_MISMATCH',
      'O tipo do evento nao pertence a este provedor.',
    );
  }
}
