import type { Request } from 'express';
import { Router } from 'express';

import { createSuccessResponse } from '../../shared/http/responses.js';
import { parseInput } from '../../shared/validation/parse.js';
import { PostgresWebhooksRepository } from './webhooks.repository.js';
import {
  n8nCallbackWebhookSchema,
  reportWebhookSchema,
  statusWebhookSchema,
  type WebhookInput,
} from './webhooks.schemas.js';
import { DefaultWebhooksService } from './webhooks.service.js';
import type { WebhookProvider, WebhookRequestData, WebhooksService } from './webhooks.types.js';

export interface WebhooksRouterOptions {
  service?: WebhooksService;
}

function requestData(request: Request): WebhookRequestData {
  return {
    rawBody: request.rawBody ?? Buffer.alloc(0),
    signature: request.get('x-webhook-signature'),
    timestamp: request.get('x-webhook-timestamp'),
    webhookId: request.get('x-webhook-id'),
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  };
}

async function handle(
  provider: WebhookProvider,
  input: WebhookInput,
  request: Request,
  service: WebhooksService,
) {
  return service.handle(provider, input, requestData(request));
}

export function createWebhooksRouter(options: WebhooksRouterOptions = {}): Router {
  const service = options.service ?? new DefaultWebhooksService(new PostgresWebhooksRepository());
  const router = Router();

  router.post('/telegram/report', async (request, response, next) => {
    try {
      const result = await handle(
        'TELEGRAM',
        parseInput(reportWebhookSchema, request.body),
        request,
        service,
      );
      response.status(result.duplicate ? 200 : 202).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.post('/whatsapp/report', async (request, response, next) => {
    try {
      const result = await handle(
        'WHATSAPP',
        parseInput(reportWebhookSchema, request.body),
        request,
        service,
      );
      response.status(result.duplicate ? 200 : 202).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.post('/status-update', async (request, response, next) => {
    try {
      const result = await handle(
        'STATUS',
        parseInput(statusWebhookSchema, request.body),
        request,
        service,
      );
      response.status(result.duplicate ? 200 : 202).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  router.post('/n8n/events', async (request, response, next) => {
    try {
      const result = await handle(
        'N8N',
        parseInput(n8nCallbackWebhookSchema, request.body),
        request,
        service,
      );
      response.status(result.duplicate ? 200 : 202).json(createSuccessResponse(request, result));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
