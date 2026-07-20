# Validacao da Fase 9

Data de referencia: 20 de julho de 2026.

Estado: implementacao e validacao tecnica concluidas; aguardando aprovacao explicita do usuario.

## Escopo implementado

- notificacoes internas: listagem, contador, leitura individual e leitura em lote;
- webhooks normalizados de Telegram, WhatsApp, status e callback do n8n;
- HMAC-SHA256 sobre `timestamp.corpo-bruto`, comparacao constante e janela anti-replay;
- rate limit por provedor e origem;
- idempotencia por `provider + external_event_id` e hash SHA-256 do payload;
- auditoria sem corpo bruto, assinatura, segredo, token ou credencial;
- outbox na mesma transacao do processamento recebido e das alteracoes de status/atribuicao;
- reserva concorrente com `FOR UPDATE SKIP LOCKED`, lease, tentativas, backoff e falha terminal;
- entrega HTTP assinada ao n8n com chave idempotente;
- seed deterministico de `webhook_events` e `outbox_events`.

## Testes automatizados

Arquivos especificos:

- `tests/unit/notifications.service.test.ts`;
- `tests/unit/webhook-security.test.ts`;
- `tests/unit/webhooks.service.test.ts`;
- `tests/unit/outbox.processor.test.ts`;
- `tests/unit/outbox.repository.test.ts`;
- `tests/unit/outbox.worker.test.ts`;
- `tests/unit/n8n-webhook.client.test.ts`;
- `tests/integration/phase9.routes.test.ts`.

Comandos obrigatorios:

```bash
npm run lint
npm run test:unit
npm run test:integration
npm run test:coverage
npm run build
npm run validate
npm run format:check
npm audit --omit=dev
```

Resultado obtido em 20 de julho de 2026:

- `npm run validate`: aprovado com 176 testes em 35 arquivos;
- testes unitarios: 122 em 26 arquivos; testes de integracao: 54 em 9 arquivos;
- cobertura: 87,16% statements, 80,58% branches, 89,44% functions e 88,85% lines;
- lint, build TypeScript e `format:check`: aprovados;
- `npm audit --omit=dev`: zero vulnerabilidades;
- `npm run db:validate`: 18 tabelas, 11 enums, 14 indices obrigatorios, 53 constraints, 8 webhooks e 3 itens de outbox validos;
- busca por `TODO`, `FIXME`, `@ts-ignore` e `@ts-expect-error`: nenhuma ocorrencia em `src` ou `tests`;
- `.env`: confirmado como ignorado pelo Git.

Durante o teste real de concorrencia foi encontrada uma referencia ambigua a `id` no `RETURNING` do claim da outbox. As colunas foram qualificadas pelo alias da tabela e um teste de regressao foi adicionado antes da bateria final.

## Teste pelo Swagger

URL: `http://localhost:3333/docs`.

### Notificacoes

1. Execute `POST /api/v1/auth/login` com `ana.cidada@example.test`.
2. Use o access token no botao **Authorize**.
3. Execute:
   - `GET /api/v1/notifications`;
   - `GET /api/v1/notifications/unread-count`;
   - `PATCH /api/v1/notifications/{notificationId}/read`;
   - `PATCH /api/v1/notifications/read-all`.
4. Espere HTTP 200 e somente itens cujo `userId` seja o usuario do token.

### Webhooks

O Swagger documenta o contrato, mas a assinatura depende dos bytes exatos do corpo. Para execucao pratica, use os exemplos Bruno da pasta `api-client/webhooks`, que calculam os tres cabecalhos imediatamente antes do envio:

- `x-webhook-id`: igual a `externalEventId`;
- `x-webhook-timestamp`: Unix timestamp em segundos;
- `x-webhook-signature`: `sha256=<HMAC-SHA256(timestamp.corpo-bruto)>`.

Rotas:

- `POST /api/v1/webhooks/telegram/report`;
- `POST /api/v1/webhooks/whatsapp/report`;
- `POST /api/v1/webhooks/status-update`;
- `POST /api/v1/webhooks/n8n/events`.

Resposta nova: HTTP 202. Repeticao identica: HTTP 200 com `duplicate: true`.

Inspecao visual concluida: Swagger UI 1.0.0 carregou os 51 caminhos da API e exibiu as quatro rotas de notificacoes e as quatro rotas assinadas de webhook da fase.

## Verificacao no Adminer

URL: `http://localhost:8080`. Servidor: `postgres`.

```sql
SELECT provider, external_event_id, event_type, status, response_code,
       length(payload_hash) AS hash_length, received_at, processed_at
FROM webhook_events
ORDER BY received_at DESC;

SELECT event_type, entity_type, entity_id, status, attempts,
       available_at, processed_at, last_error
FROM outbox_events
ORDER BY created_at DESC;

SELECT action, entity_type, entity_id, new_data, created_at
FROM audit_logs
WHERE action = 'WEBHOOK_PROCESSED'
ORDER BY created_at DESC;

SELECT user_id, type, title, read_at, created_at
FROM notifications
ORDER BY created_at DESC;
```

Resultado esperado:

- um unico `webhook_events` por provedor e ID externo;
- `payload_hash` com 64 caracteres hexadecimais;
- evento aceito em `PROCESSED` e resposta 202;
- outbox em `PENDING`, `PROCESSING`, `PROCESSED` ou `FAILED`, com tentativas nao negativas;
- auditoria apenas com provedor, tipo, resultado e IDs operacionais;
- nenhuma coluna ou JSON contendo assinatura ou segredo.

Resultado obtido: o Adminer 4.17.1 confirmou as estruturas, indices e constraints das duas tabelas. A consulta final mostrou tres itens de outbox `PROCESSED`: o seed com zero tentativa, WhatsApp com uma tentativa e Telegram com duas tentativas apos uma falha temporaria.

## Validacao HTTP real

| Cenario                                     | Resultado |
| ------------------------------------------- | --------- |
| Login e listagem de 2 notificacoes proprias | HTTP 200  |
| Leitura individual e leitura em lote        | HTTP 200  |
| Telegram novo / repetido                    | 202 / 200 |
| Mesmo ID do Telegram com outro payload      | HTTP 409  |
| Assinatura invalida                         | HTTP 401  |
| Limite excedido apos a janela configurada   | HTTP 429  |
| WhatsApp novo                               | HTTP 202  |
| Atualizacao de status assinada              | HTTP 202  |
| Callback n8n novo / repetido                | 202 / 200 |
| Health da API / banco                       | 200 / 200 |

Para o envio de saida, um receptor n8n local validou assinatura, ID e chave idempotente. A primeira chamada autenticada respondeu 503, a retentativa respondeu 204 e a outbox terminou `PROCESSED` com duas tentativas e sem `last_error` residual.

## Casos de sucesso

| Entrada/acao                    |    HTTP | Banco                      | Resultado                         |
| ------------------------------- | ------: | -------------------------- | --------------------------------- |
| Listar notificacoes autenticado |     200 | nenhuma alteracao          | somente notificacoes proprias     |
| Marcar notificacao propria      |     200 | `notifications.read_at`    | operacao idempotente              |
| Webhook assinado novo           |     202 | evento, auditoria e outbox | `duplicate: false`                |
| Mesmo ID e mesmo corpo          |     200 | nenhuma nova outbox        | `duplicate: true`                 |
| Entrega n8n HTTP 2xx            | interno | outbox `PROCESSED`         | `processed_at` preenchido         |
| Falha temporaria n8n            | interno | volta a `PENDING`          | `available_at` com backoff        |
| Ultima tentativa falha          | interno | outbox `FAILED`            | codigo sanitizado em `last_error` |

## Casos de erro

| Condicao                           | HTTP | Codigo                       |
| ---------------------------------- | ---: | ---------------------------- |
| Cabecalho ausente                  |  401 | `WEBHOOK_SIGNATURE_REQUIRED` |
| Assinatura invalida                |  401 | `INVALID_WEBHOOK_SIGNATURE`  |
| Timestamp expirado                 |  401 | `EXPIRED_WEBHOOK`            |
| ID do cabecalho divergente         |  401 | `WEBHOOK_ID_MISMATCH`        |
| Mesmo ID com outro corpo           |  409 | `WEBHOOK_EVENT_CONFLICT`     |
| Payload invalido                   |  422 | `VALIDATION_ERROR`           |
| Limite excedido                    |  429 | `WEBHOOK_RATE_LIMITED`       |
| Segredo ausente em desenvolvimento |  503 | `WEBHOOK_NOT_CONFIGURED`     |
| Outbox inexistente no callback     |  404 | `OUTBOX_EVENT_NOT_FOUND`     |

## Matriz de permissoes

| Rota                              | CITIZEN         | CITY_OPERATOR   | MODERATOR       | ADMIN           | Integrador HMAC |
| --------------------------------- | --------------- | --------------- | --------------- | --------------- | --------------- |
| `GET /notifications`              | proprio         | proprio         | proprio         | proprio         | negado sem JWT  |
| `GET /notifications/unread-count` | proprio         | proprio         | proprio         | proprio         | negado sem JWT  |
| `PATCH /notifications/:id/read`   | proprio         | proprio         | proprio         | proprio         | negado sem JWT  |
| `PATCH /notifications/read-all`   | proprio         | proprio         | proprio         | proprio         | negado sem JWT  |
| `POST /webhooks/telegram/report`  | negado sem HMAC | negado sem HMAC | negado sem HMAC | negado sem HMAC | permitido       |
| `POST /webhooks/whatsapp/report`  | negado sem HMAC | negado sem HMAC | negado sem HMAC | negado sem HMAC | permitido       |
| `POST /webhooks/status-update`    | negado sem HMAC | negado sem HMAC | negado sem HMAC | negado sem HMAC | permitido       |
| `POST /webhooks/n8n/events`       | negado sem HMAC | negado sem HMAC | negado sem HMAC | negado sem HMAC | permitido       |

## Limitacoes honestas

- Telegram e WhatsApp recebem um contrato normalizado e geram outbox; bots conversacionais completos sao funcionalidade adicional no PRD.
- O webhook de status registra e audita o evento sem criar um ciclo de retorno ao n8n; ele nao contorna autenticacao, autorizacao ou a maquina de estados da API.
- Sem `N8N_WEBHOOK_URL`, a outbox permanece pendente e o worker fica desativado em desenvolvimento.
- A fila usa PostgreSQL, adequada ao MVP; fila distribuida permanece adicional.
- Os segredos atuais sao exclusivamente locais e ficticios; em producao devem ser substituidos por valores fortes e exclusivos antes do deploy.

## Checklist final da fase

- [x] Validar segredo, assinatura, rate limit, idempotencia e hash do payload.
- [x] Impedir duplicidade, auditar e remover segredos dos logs.
- [x] Implementar webhooks Telegram, WhatsApp, status e n8n.
- [x] Implementar `webhook_events`, `outbox_events`, estados, tentativas e falhas.
- [x] Testar assinatura, duplicidade, payload, rate limit, processamento, falha, retry e logs.
- [x] Conferir eventos e outbox no Adminer.
- [x] Atualizar Swagger, colecao Bruno e README.
- [~] Obter aprovacao explicita do usuario.
