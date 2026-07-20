# Contrato de integracao com n8n

Versao do contrato: 1.0. A entrega usa outbox PostgreSQL e e pelo menos uma vez; o consumidor deve ser idempotente.

## API para n8n

A API envia `POST {N8N_WEBHOOK_URL}`.

Cabecalhos:

| Cabecalho             | Valor                                                        |
| --------------------- | ------------------------------------------------------------ |
| `content-type`        | `application/json`                                           |
| `idempotency-key`     | UUID do `outbox_events`                                      |
| `x-webhook-id`        | o mesmo UUID do outbox                                       |
| `x-webhook-timestamp` | Unix timestamp em segundos                                   |
| `x-webhook-signature` | `sha256=HMAC_SHA256(timestamp + "." + corpo_bruto, segredo)` |

Envelope:

```json
{
  "id": "78000000-0000-4000-8000-000000000001",
  "eventType": "OCCURRENCE_STATUS_CHANGED",
  "entityType": "occurrence",
  "entityId": "60000000-0000-4000-8000-000000000001",
  "occurredAt": "2026-07-20T12:00:00.000Z",
  "payload": {}
}
```

Qualquer HTTP 2xx confirma a entrega. Timeout, erro de rede ou resposta nao 2xx geram retry com backoff exponencial. O padrao e 3 tentativas; depois o evento termina `FAILED`. `FOR UPDATE SKIP LOCKED` e lease evitam processamento concorrente do mesmo lote.

## n8n para API

Callback: `POST /api/v1/webhooks/n8n/events`, com os mesmos tres cabecalhos `x-webhook-*` e assinatura sobre o corpo bruto.

```json
{
  "externalEventId": "n8n-callback-001",
  "eventType": "OUTBOX_DELIVERY_CALLBACK",
  "occurredAt": "2026-07-20T12:00:05.000Z",
  "data": {
    "outboxEventId": "78000000-0000-4000-8000-000000000001",
    "deliveryStatus": "PROCESSED"
  }
}
```

Respostas:

- 202 para evento novo;
- 200 com `duplicate: true` para repeticao identica;
- 401 para assinatura, timestamp ou ID invalido;
- 404 quando o outbox alvo nao existe;
- 409 quando o mesmo ID externo usa outro payload;
- 422 para contrato invalido;
- 429 para limite excedido.

## Outros webhooks normalizados

- `POST /api/v1/webhooks/telegram/report`;
- `POST /api/v1/webhooks/whatsapp/report`;
- `POST /api/v1/webhooks/status-update`.

Telegram e WhatsApp enfileiram eventos normalizados. O webhook de status apenas registra e audita; ele nao contorna JWT, autorizacao ou a maquina de estados. Bots conversacionais completos permanecem fora do MVP.

## Operacao segura

- use segredo n8n exclusivo, com pelo menos 32 caracteres;
- compare HMAC em tempo constante;
- rejeite timestamp fora da janela e IDs divergentes;
- nunca registre assinatura, segredo ou corpo bruto;
- deduplique por `idempotency-key` antes de efeitos externos;
- monitore `PENDING`, `PROCESSING` antigo e `FAILED`;
- rotacione segredo de forma coordenada, aceitando os dois valores apenas durante uma janela controlada.
