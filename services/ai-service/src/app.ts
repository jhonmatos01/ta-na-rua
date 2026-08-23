import { createHash, timingSafeEqual } from 'node:crypto';

import express from 'express';
import helmet from 'helmet';

import {
  aiServiceRequestSchema,
  aiServiceResponseSchema,
} from './contracts.js';
import type { AiServiceConfig } from './config.js';
import { analyzeOccurrence } from './engine.js';

import {
  AiProviderError,
  analyzeWithOpenAiCompatible,
  type FetchImplementation,
} from './provider.js';

type RuntimeConfig = Pick<AiServiceConfig, 'mode' | 'secret'> &
  Partial<
    Pick<
      AiServiceConfig,
      | 'providerBaseUrl'
      | 'providerApiKey'
      | 'providerModel'
      | 'providerTimeoutMs'
      | 'forceHumanReview'
    >
  > & { fetchImplementation?: FetchImplementation };

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function secretsMatch(provided: string, expected: string): boolean {
  return timingSafeEqual(digest(provided), digest(expected));
}

function isEntityTooLarge(error: unknown): boolean {
  return (
    error instanceof Error &&
    'type' in error &&
    error.type === 'entity.too.large'
  );
}

export function createApp(config: RuntimeConfig): express.Express {
  const app = express();
  const jsonParser = express.json({
    limit: '256kb',
    type: ['application/json', 'application/*+json'],
  });

  app.disable('x-powered-by');
  app.use(helmet());

  app.get('/health', (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).json({
      status: 'ok',
      mode: config.mode,
      providerConfigured:
        config.mode === 'OPENAI_COMPATIBLE' && config.providerBaseUrl !== undefined,
      productionReady:
        config.mode === 'OPENAI_COMPATIBLE' &&
        config.providerBaseUrl?.startsWith('https://') === true,
      humanReviewRequired: config.forceHumanReview ?? true,
    });
  });

  app.post(
    '/analyze',
    (request, response, next) => {
      const providedSecret = request.get('x-ai-service-secret');

      if (
        providedSecret === undefined ||
        !secretsMatch(providedSecret, config.secret)
      ) {
        response.setHeader('Cache-Control', 'no-store');
        response.status(401).json({
          error: 'unauthorized',
          message: 'Credencial do serviço inválida.',
        });
        return;
      }

      next();
    },
    jsonParser,
    async (request, response) => {
      response.setHeader('Cache-Control', 'no-store');

      const parsedRequest = aiServiceRequestSchema.safeParse(request.body);

      if (!parsedRequest.success) {
        response.status(422).json({
          error: 'invalid_request',
          message: 'O corpo da análise não corresponde ao contrato esperado.',
        });
        return;
      }

      const idempotencyKey = request.get('x-idempotency-key');

      if (
        idempotencyKey === undefined ||
        idempotencyKey !== parsedRequest.data.reportId
      ) {
        response.status(422).json({
          error: 'invalid_idempotency_key',
          message:
            'A chave de idempotência deve corresponder ao identificador do reporte.',
        });
        return;
      }

      try {
        const analysis =
          config.mode === 'DETERMINISTIC'
            ? analyzeOccurrence(parsedRequest.data)
            : await analyzeWithOpenAiCompatible(parsedRequest.data, {
                baseUrl: config.providerBaseUrl as string,
                model: config.providerModel ?? 'Meu primeiro combo',
                timeoutMs: config.providerTimeoutMs ?? 60_000,
                forceHumanReview: config.forceHumanReview ?? true,
                ...(config.providerApiKey === undefined
                  ? {}
                  : { apiKey: config.providerApiKey }),
                ...(config.fetchImplementation === undefined
                  ? {}
                  : { fetchImplementation: config.fetchImplementation }),
              });

        response.status(200).json(aiServiceResponseSchema.parse(analysis));
      } catch (error) {
        if (error instanceof AiProviderError) {
          response.status(error.statusCode).json({
            error: error.kind === 'INVALID_RESPONSE'
              ? 'invalid_provider_response'
              : 'provider_unavailable',
            message: 'O serviço de IA não pôde concluir a análise.',
          });
          return;
        }

        response.status(502).json({
          error: 'invalid_provider_response',
          message: 'O serviço de IA não pôde concluir a análise.',
        });
      }
    },
  );

  app.use((_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.status(404).json({
      error: 'not_found',
      message: 'Rota não encontrada.',
    });
  });

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      response.setHeader('Cache-Control', 'no-store');

      if (isEntityTooLarge(error)) {
        response.status(413).json({
          error: 'payload_too_large',
          message: 'O corpo da solicitação excede o limite permitido.',
        });
        return;
      }

      if (error instanceof SyntaxError) {
        response.status(400).json({
          error: 'invalid_json',
          message: 'O corpo da solicitação não contém JSON válido.',
        });
        return;
      }

      response.status(500).json({
        error: 'internal_error',
        message: 'Não foi possível concluir a análise.',
      });
    },
  );

  return app;
}
