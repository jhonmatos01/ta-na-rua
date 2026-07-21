# Ta na Rua! — back-end e aplicativo cidadão

API REST da plataforma de inteligencia urbana colaborativa **Ta na Rua!**, implementada a partir do PRD Tecnico Consolidado v1.2.

Estado atual: **back-end MVP concluído e preservado; FE‑0 do aplicativo cidadão em validação final**. O acompanhamento detalhado fica em [docs/PROGRESSO.md](docs/PROGRESSO.md).

## O que existe

- aplicação cidadã responsiva em `apps/citizen-web`, com rotas iniciais, status real da API, acessibilidade e testes;

- Node.js 24, TypeScript estrito e Express;
- validacao de ambiente com Zod;
- logs estruturados com Pino e remocao de campos sensiveis;
- request ID em todas as respostas;
- Helmet, CORS restrito e limite de corpo JSON;
- respostas de sucesso e erro padronizadas;
- `GET /health` e `GET /health/database`;
- PostgreSQL 17 com PostGIS, Adminer e healthcheck via Docker Compose;
- Drizzle ORM, Drizzle Kit e migration versionada para habilitar PostGIS;
- Swagger UI, OpenAPI 3.0.3 e esquema JWT Bearer preparado;
- testes com Vitest, Supertest e metas de cobertura;
- colecao Bruno para as rotas implementadas.
- schema Drizzle definitivo com 18 tabelas e 11 enums;
- constraints de coordenadas, notas, gravidade, confianca, contadores e autorreferencia;
- indices de negocio, dashboard e GiST para as colunas PostGIS;
- seed idempotente com municipios, bairros, categorias, departamentos, ocorrencias e analise de IA ficticia;
- validador automatizado do schema e dos dados ate a fase atual;
- cadastro restrito ao perfil `CITIZEN`, validacao Zod e senha Argon2id;
- access token JWT de 15 minutos e refresh opaco de 7 dias em cookie `httpOnly`;
- hash SHA-256 do refresh, rotacao atomica, revogacao e deteccao de reutilizacao;
- login, logout, troca de senha, perfil e exclusao logica;
- autorizacao por autenticacao, perfil, municipio e proprietario;
- gestao administrativa de usuarios com revogacao imediata de sessoes;
- criacao transacional de ocorrencia com protocolo anual atomico, relato, historico, auditoria e notificacao;
- upload multipart JPEG/PNG/WebP com MIME real, limite configuravel, chave aleatoria e limpeza de orfaos;
- armazenamento local de desenvolvimento e adaptador S3 compativel para producao;
- listagem, detalhes, ocorrencias proprias, filtros, paginacao, mapa, proximidade e linha do tempo;
- consultas PostGIS com `ST_DWithin`, ponto `geography(Point,4326)` e indice GiST;
- privacidade publica de autor, endereco e coordenadas e isolamento do operador municipal;
- confirmacao cidada `Eu tambem vi`, remocao da propria confirmacao e contagem publica;
- prevencao transacional de duplicidade, contador consistente, notificacao e auditoria;
- `PriorityService` exclusivo com confirmacoes, gravidade, idade e risco, alem de reconciliacao administrativa;
- CRUD, ativacao e inativacao de departamentos com isolamento municipal;
- maquina definitiva com 24 transicoes e permissoes por perfil;
- atribuicao, previsao, agendamento, resolucao, fechamento, contestacao e reabertura;
- historico publico protegido, auditoria e notificacoes dentro da transacao;
- avaliacoes de reparo por cidadao relacionado, com nota, resolucao do problema, qualidade opcional e comentario;
- edicao da propria avaliacao por sete dias e resumo publico sem dados pessoais;
- contestacao automatica com minimo de tres avaliacoes e pelo menos 50% negativas;
- historico, auditoria, notificacoes e limpeza das datas de conclusao na mesma transacao da contestacao;
- cliente HTTP de IA com contrato Zod, segredo, timeout, retry limitado e chave idempotente;
- classificacao segura de categoria, subcategoria, gravidade, risco, confianca e resumo;
- sugestoes de duplicidade para revisao humana, sem alteracao automatica de status ou fusao;
- fallback persistido que preserva a ocorrencia em timeout, indisponibilidade ou resposta invalida;
- resultado recebido e validado em `ai_analyses`, com remocao recursiva de campos sensiveis;
- tres rotas internas protegidas por `x-ai-service-secret` e segredo redigido dos logs;
- painel municipal com resumo, categoria, bairro, status, ranking e tempo de resolucao;
- filtros compartilhados de periodo, categoria, bairro, status e municipio, sempre limitados pelo perfil;
- mapa de calor em celulas agregadas de 250 metros, sem coordenadas exatas de ocorrencias;
- exportacao CSV de ate 10.000 linhas, sem dados pessoais e protegida contra formulas;
- agregacoes SQL sem N+1 e indices compostos para municipio, periodo, prioridade e resolucao;
- notificacoes internas paginadas, contador e leitura individual ou em lote, sempre isoladas pelo usuario;
- webhooks Telegram, WhatsApp, status e n8n com HMAC-SHA256 sobre o corpo bruto, timestamp e identificador externo;
- rate limit por provedor e origem, hash SHA-256, idempotencia e conflito para payload divergente;
- auditoria de processamento sem segredo, token, corpo bruto ou credencial nos logs;
- outbox transacional nas alteracoes de status e nos eventos recebidos, com reserva concorrente e recuperacao de lease;
- entrega assinada ao n8n com chave idempotente, timeout, backoff exponencial e limite de tentativas;
- Swagger 1.0.0 e colecao Bruno com exemplos dinamicamente assinados para a Fase 9.
- rate limit global com headers padronizados, proxy confiavel configuravel e validacao endurecida de producao;
- imagem Docker multi-stage sem privilegios e compose de producao sem Adminer ou porta publica do banco;
- contratos finais de IA, painel e n8n, relatorio de seguranca, limitacoes e roteiro de deploy.

## Pre-requisitos

- Node.js 24 ou superior;
- npm;
- Docker Desktop com Docker Compose v2;
- Git.

Confirme as ferramentas:

```bash
node --version
npm --version
docker compose version
```

## Instalacao local

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo de ambiente.

PowerShell:

```powershell
Copy-Item .env.example .env
```

Linux ou macOS:

```bash
cp .env.example .env
```

3. Altere `POSTGRES_PASSWORD` e atualize a mesma senha dentro de `DATABASE_URL`. O valor de `.env.example` e apenas ficticio para desenvolvimento.

4. Inicie PostgreSQL/PostGIS e Adminer:

```bash
npm run docker:up
```

5. Execute a migration e o seed da fase:

```bash
npm run db:migrate
npm run db:seed
npm run db:validate
```

O seed final cria dados ficticios deterministas, inclusive duracao de resolucao, evento de webhook e item de outbox, e pode ser repetido sem duplicacoes. Ele e bloqueado em producao. Todas as senhas abaixo sao exclusivas do ambiente local e ficam armazenadas somente como Argon2id no PostgreSQL.

| Perfil/outro cenario | E-mail                           | Senha                | Municipio        |
| -------------------- | -------------------------------- | -------------------- | ---------------- |
| CITIZEN              | `ana.cidada@example.test`        | `Cidada123!Fase2`    | Salvador         |
| CITIZEN              | `carla.cidada@example.test`      | `Cidada123!Fase2`    | Feira de Santana |
| CITY_OPERATOR        | `bruno.operador@example.test`    | `Operador123!Fase2`  | Salvador         |
| CITY_OPERATOR        | `davi.operador@example.test`     | `Operador123!Fase2`  | Feira de Santana |
| MODERATOR            | `marina.moderadora@example.test` | `Moderador123!Fase2` | Salvador         |
| ADMIN                | `adriano.admin@example.test`     | `Admin123!Fase2`     | Salvador         |
| Bloqueada            | `bia.bloqueada@example.test`     | `Bloqueada123!Fase2` | Salvador         |

6. Inicie a API:

```bash
npm run dev
```

## Portas e acessos

| Servico      | Endereco                                |
| ------------ | --------------------------------------- |
| API          | http://localhost:3333                   |
| App cidadão  | http://localhost:5173                   |
| Swagger UI   | http://localhost:3333/docs              |
| OpenAPI JSON | http://localhost:3333/docs/openapi.json |
| Adminer      | http://localhost:8080                   |
| PostgreSQL   | localhost:5432                          |

### Interfaces visuais de teste

- **Aplicativo cidadão FE‑0** em `http://localhost:5173`, com início, status dos serviços, indisponibilidade e 404. O guia fica em [apps/citizen-web/README.md](apps/citizen-web/README.md).
- **Swagger UI** e a interface principal para testar a API: autentique com `Authorize`, preencha os formularios e execute cada rota, inclusive uploads de imagem.
- **Adminer** permite inspecionar visualmente o PostgreSQL/PostGIS com os valores de `POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_DB` do `.env` local.
- A pasta `api-client` pode ser aberta no aplicativo **Bruno** para executar os cenarios agrupados por modulo.

A FE‑0 não inclui ainda as jornadas finais de autenticação, mapa ou ocorrências, nem interfaces de operador e administrador. Consulte [docs/FE0_LIMITACOES.md](docs/FE0_LIMITACOES.md).

## Variaveis de ambiente da fase

| Variavel                                | Obrigatoria   | Finalidade                                  |
| --------------------------------------- | ------------- | ------------------------------------------- |
| `NODE_ENV`                              | Nao           | `development`, `test` ou `production`       |
| `PORT`                                  | Nao           | Porta HTTP; padrao `3333`                   |
| `DATABASE_URL`                          | Sim           | URL completa do PostgreSQL                  |
| `CORS_ORIGIN`                           | Nao           | Origem permitida pelo CORS                  |
| `TRUST_PROXY_HOPS`                      | Nao           | Proxies confiaveis; padrao local `0`        |
| `JSON_BODY_LIMIT`                       | Nao           | Limite do corpo JSON                        |
| `API_RATE_LIMIT_MAX`                    | Nao           | Requisicoes por origem; padrao 300          |
| `API_RATE_LIMIT_WINDOW_SECONDS`         | Nao           | Janela global; padrao 60 segundos           |
| `LOG_LEVEL`                             | Nao           | Nivel dos logs Pino                         |
| `JWT_ACCESS_SECRET`                     | Sim em prod   | Segredo do JWT, com ao menos 32 caracteres  |
| `JWT_ISSUER`                            | Nao           | Emissor esperado no JWT                     |
| `JWT_AUDIENCE`                          | Nao           | Publico esperado no JWT                     |
| `ACCESS_TOKEN_TTL_MINUTES`              | Nao           | Duracao do access token; padrao 15          |
| `REFRESH_TOKEN_TTL_DAYS`                | Nao           | Duracao do refresh; padrao 7                |
| `PASSWORD_MIN_LENGTH`                   | Nao           | Tamanho minimo da senha; padrao 12          |
| `MAX_IMAGES_PER_OCCURRENCE`             | Nao           | Maximo de imagens; padrao 5                 |
| `MAX_IMAGE_SIZE_MB`                     | Nao           | Maximo por imagem; padrao 8 MB              |
| `DUPLICATE_RADIUS_METERS`               | Nao           | Raio geoespacial padrao; 30 m               |
| `DUPLICATE_PERIOD_DAYS`                 | Nao           | Janela futura de duplicidade; 30 dias       |
| `DEFAULT_PAGE_SIZE`                     | Nao           | Paginacao padrao; 20                        |
| `MAX_PAGE_SIZE`                         | Nao           | Limite maximo por pagina; 100               |
| `EVALUATION_EDIT_WINDOW_DAYS`           | Nao           | Prazo de edicao da avaliacao; padrao 7 dias |
| `EVALUATION_NEGATIVE_THRESHOLD`         | Nao           | Proporcao negativa; padrao 0,5              |
| `EVALUATION_MIN_COUNT_FOR_CONTESTATION` | Nao           | Minimo para contestacao; padrao 3           |
| `AI_SERVICE_URL`                        | Sim em prod   | URL base do servico externo de IA           |
| `AI_SERVICE_SECRET`                     | Sim em prod   | Segredo enviado somente em cabecalho        |
| `AI_MODEL_NAME`                         | Nao           | Nome registrado; `external-ai-service`      |
| `AI_TIMEOUT_MS`                         | Nao           | Timeout por tentativa; padrao 8000 ms       |
| `AI_MAX_ATTEMPTS`                       | Nao           | Tentativas totais; padrao 2                 |
| `AI_MIN_CONFIDENCE`                     | Nao           | Confianca minima para aplicar; padrao 0,75  |
| `AI_DUPLICATE_MIN_SIMILARITY`           | Nao           | Limiar de duplicidade; padrao 0,80          |
| `TELEGRAM_WEBHOOK_SECRET`               | Sim em prod   | Segredo HMAC exclusivo do Telegram          |
| `WHATSAPP_WEBHOOK_SECRET`               | Sim em prod   | Segredo HMAC exclusivo do WhatsApp          |
| `N8N_WEBHOOK_SECRET`                    | Sim em prod   | Segredo HMAC de entrada e saida do n8n      |
| `N8N_WEBHOOK_URL`                       | Sim em prod   | Destino da entrega de eventos da outbox     |
| `WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS`   | Nao           | Janela anti-replay; padrao 300 segundos     |
| `WEBHOOK_RATE_LIMIT_MAX`                | Nao           | Maximo por provedor/origem e janela         |
| `WEBHOOK_RATE_LIMIT_WINDOW_SECONDS`     | Nao           | Janela do rate limit; padrao 60 segundos    |
| `OUTBOX_MAX_ATTEMPTS`                   | Nao           | Tentativas totais de entrega; padrao 3      |
| `OUTBOX_RETRY_BASE_SECONDS`             | Nao           | Base do backoff exponencial; padrao 30      |
| `OUTBOX_BATCH_SIZE`                     | Nao           | Eventos reservados por lote; padrao 20      |
| `OUTBOX_POLL_INTERVAL_MS`               | Nao           | Intervalo do worker; padrao 5000 ms         |
| `MUNICIPALITY_MAX_DISTANCE_METERS`      | Nao           | Distancia maxima do centro municipal        |
| `STORAGE_PROVIDER`                      | Nao           | `local` em dev ou `s3` em producao          |
| `STORAGE_LOCAL_DIRECTORY`               | Nao           | Diretorio local ignorado pelo Git           |
| `STORAGE_PUBLIC_BASE_URL`               | Nao           | Base publica das URLs de imagem             |
| `STORAGE_BUCKET`                        | Com S3        | Bucket S3 compativel                        |
| `STORAGE_REGION`                        | Com S3        | Regiao do bucket                            |
| `STORAGE_ENDPOINT`                      | Nao           | Endpoint de provedor S3 compativel          |
| `STORAGE_ACCESS_KEY`                    | Com S3        | Credencial mantida fora do repositorio      |
| `STORAGE_SECRET_KEY`                    | Com S3        | Segredo mantido fora do repositorio         |
| `POSTGRES_DB`                           | Sim no Docker | Banco criado pelo container                 |
| `POSTGRES_USER`                         | Sim no Docker | Usuario do PostgreSQL                       |
| `POSTGRES_PASSWORD`                     | Sim no Docker | Senha local do PostgreSQL                   |
| `POSTGRES_PORT`                         | Nao           | Porta publicada pelo Docker                 |

A API interrompe a inicializacao quando `DATABASE_URL`, `PORT` ou outra configuracao validada for invalida. Em producao, exige CORS HTTPS, storage S3, IA, n8n, segredos exclusivos e rejeita placeholders. Senhas, tokens, cookies, cabecalhos de autorizacao, `x-ai-service-secret`, `x-webhook-signature` e segredos de webhook sao removidos dos logs.

## Roteiro de validacao local

### 1. Testes automatizados

Execute:

```bash
npm run lint
npm run test:unit
npm run test:integration
npm run test:coverage
npm run build
npm run validate
```

Resultado esperado: todos os comandos terminam com codigo zero. As metas iniciais de cobertura sao 80% para statements, functions e lines, e 70% para branches.

Os testes cobrem:

- ambiente valido e invalido;
- resposta da API e request ID;
- request ID fornecido pelo cliente;
- conexao logica com PostGIS;
- banco indisponivel com HTTP 503;
- rota inexistente com HTTP 404;
- JSON malformado com HTTP 400;
- OpenAPI e Swagger UI.

### 2. Teste pelo Swagger

1. Acesse http://localhost:3333/docs.
2. Abra `GET /health`, clique em **Try it out** e depois **Execute**.
3. Confirme HTTP 200, `success: true`, `data.status: "ok"` e `meta.requestId`.
4. Repita em `GET /health/database`.
5. Confirme HTTP 200, `data.status: "connected"` e `data.postgisVersion`.

O botao **Authorize** aceita o `accessToken` real retornado por login ou refresh. Informe apenas o JWT; o Swagger adiciona `Bearer` ao cabecalho. O refresh permanece em cookie `httpOnly` e nao deve ser colado no Authorize. As duas rotas de health sao publicas.

### 3. Teste com curl

```bash
curl -i http://localhost:3333/health
curl -i http://localhost:3333/health/database
curl -i http://localhost:3333/docs/openapi.json
```

Para verificar a propagacao do request ID:

```bash
curl -i -H "x-request-id: teste-manual-001" http://localhost:3333/health
```

O cabecalho e `meta.requestId` devem retornar `teste-manual-001`.

### 4. Verificacao no Adminer

Acesse http://localhost:8080 e use:

| Campo         | Valor                        |
| ------------- | ---------------------------- |
| Sistema       | PostgreSQL                   |
| Servidor      | `postgres`                   |
| Usuario       | valor de `POSTGRES_USER`     |
| Senha         | valor de `POSTGRES_PASSWORD` |
| Base de dados | valor de `POSTGRES_DB`       |

No Adminer, execute:

```sql
SELECT PostGIS_Version();
```

Resultado esperado: uma linha com a versao instalada do PostGIS.

Depois confirme a tabela de controle criada pelo migrador do Drizzle no schema `drizzle`. Na Fase 1, confira tambem as 18 tabelas de dominio, os 11 enums, os indices GiST de `occurrences.location` e `occurrence_reports.location`, e os dados ficticios. O roteiro SQL completo esta em [docs/FASE1_VALIDACAO.md](docs/FASE1_VALIDACAO.md), e os relacionamentos estao em [docs/ERD.md](docs/ERD.md).

### 5. Casos de sucesso

| Acao                            | Codigo | Efeito esperado                             |
| ------------------------------- | ------ | ------------------------------------------- |
| `GET /health`                   | 200    | Confirma API e devolve timestamp/request ID |
| `GET /health/database`          | 200    | Confirma PostgreSQL e PostGIS               |
| `GET /docs/openapi.json`        | 200    | Devolve a especificacao OpenAPI             |
| `npm run db:migrate`            | 0      | Habilita PostGIS e registra a migration     |
| `npm run db:seed`               | 0      | Insere ou preserva os dados ficticios       |
| `npm run db:validate`           | 0      | Confirma schema, PostGIS, indices e seed    |
| `POST /api/v1/auth/login`       | 200    | Cria sessao, JWT e cookie `httpOnly`        |
| `POST /api/v1/auth/refresh`     | 200    | Rotaciona refresh e emite novo JWT          |
| `GET /api/v1/users/me`          | 200    | Retorna somente dados seguros do perfil     |
| `GET /api/v1/dashboard/summary` | 200    | Resume ocorrencias no municipio permitido   |
| `GET /api/v1/dashboard/export`  | 200    | Exporta CSV limitado e sem dados pessoais   |

### 6. Casos de erro

| Condicao                       | Codigo/resultado | Resposta esperada                                |
| ------------------------------ | ---------------- | ------------------------------------------------ |
| Banco parado                   | 503              | `DATABASE_UNAVAILABLE`                           |
| Rota inexistente               | 404              | `ROUTE_NOT_FOUND`                                |
| Corpo JSON malformado          | 400              | `INVALID_JSON`                                   |
| Credenciais invalidas          | 401              | `INVALID_CREDENTIALS`                            |
| Token ausente/invalido         | 401              | `AUTHENTICATION_REQUIRED`/`INVALID_ACCESS_TOKEN` |
| Refresh reutilizado            | 401              | `REFRESH_TOKEN_REUSE_DETECTED`                   |
| Usuario bloqueado              | 403              | `USER_BLOCKED`                                   |
| Perfil sem permissao           | 403              | `FORBIDDEN`                                      |
| E-mail/telefone duplicado      | 409              | `USER_ALREADY_EXISTS`                            |
| Entrada invalida               | 422              | `VALIDATION_ERROR`                               |
| Imagem ausente                 | 422              | `IMAGE_REQUIRED`                                 |
| Imagem acima do limite         | 413              | `IMAGE_TOO_LARGE`                                |
| MIME real invalido             | 415              | `UNSUPPORTED_IMAGE_TYPE`/`IMAGE_MIME_MISMATCH`   |
| Ocorrencia nao avaliavel       | 409              | `OCCURRENCE_NOT_EVALUABLE`                       |
| Avaliacao duplicada            | 409              | `EVALUATION_ALREADY_EXISTS`                      |
| Prazo de edicao expirado       | 409              | `EVALUATION_EDIT_WINDOW_EXPIRED`                 |
| Cidadao nao relacionado        | 403              | `OCCURRENCE_RELATION_REQUIRED`                   |
| Segredo interno de IA invalido | 401              | `INVALID_AI_SERVICE_SECRET`                      |
| IA interna nao configurada     | 503              | `AI_SERVICE_NOT_CONFIGURED`                      |
| Assinatura de webhook invalida | 401              | `INVALID_WEBHOOK_SIGNATURE`                      |
| Evento com ID e payload novo   | 409              | `WEBHOOK_EVENT_CONFLICT`                         |
| Rate limit do webhook          | 429              | `WEBHOOK_RATE_LIMITED`                           |
| `DATABASE_URL` ausente         | processo encerra | erro de ambiente sem expor segredo               |
| PostGIS ausente                | 503              | health do banco indisponivel                     |

### 7. Matriz de permissoes da fase

| Grupo de rotas                          | CITIZEN         | CITY_OPERATOR   | MODERATOR       | ADMIN           |
| --------------------------------------- | --------------- | --------------- | --------------- | --------------- |
| Health, docs, register, login e refresh | Permitido       | Permitido       | Permitido       | Permitido       |
| `auth/me`, troca de senha e `users/me`  | Proprio         | Proprio         | Proprio         | Proprio         |
| `GET/PATCH/DELETE /users/me`            | Proprio         | Proprio         | Proprio         | Proprio         |
| `/api/v1/admin/users*`                  | Negado          | Negado          | Negado          | Permitido       |
| Recurso do mesmo municipio              | Permitido       | Permitido       | Global          | Global          |
| Alteracao de recurso por proprietario   | Proprio         | Proprio         | Global          | Global          |
| Criar ocorrencia e adicionar imagem     | Permitido       | Mesmo municipio | Global          | Global          |
| Ver pendencias de outro autor           | Negado          | Mesmo municipio | Global          | Global          |
| Excluir ocorrencia logicamente          | Negado          | Negado          | Permitido       | Permitido       |
| Confirmar/remover confirmacao           | Proprio         | Negado          | Negado          | Negado          |
| Consultar contagem publica              | Permitido       | Permitido       | Permitido       | Permitido       |
| Alterar status operacional              | Negado          | Mesmo municipio | Global          | Global          |
| Publicar/rejeitar/duplicar/reabrir      | Negado          | Negado          | Global          | Global          |
| Gerenciar departamentos                 | Negado          | Mesmo municipio | Global          | Global          |
| Consultar historico publico             | Permitido       | Permitido       | Permitido       | Permitido       |
| Criar/editar avaliacao                  | Relacionado     | Negado          | Negado          | Negado          |
| Consultar avaliacoes detalhadas         | Relacionado     | Mesmo municipio | Global          | Global          |
| Consultar resumo publico de avaliacoes  | Permitido       | Permitido       | Permitido       | Permitido       |
| Rotas `/api/v1/internal/ai/*`           | Segredo interno | Segredo interno | Segredo interno | Segredo interno |
| Consultar dashboard e exportar CSV      | Negado          | Mesmo municipio | Global          | Global          |
| Consultar/ler notificacoes              | Proprio         | Proprio         | Proprio         | Proprio         |
| Rotas `/api/v1/webhooks/*`              | HMAC externo    | HMAC externo    | HMAC externo    | HMAC externo    |

Usuario `BLOCKED`, `PENDING`, `DELETED` ou com sessao revogada nao acessa rotas protegidas.

## Colecao Bruno

Abra a pasta `api-client` no Bruno, selecione o ambiente `local` e execute primeiro um login em `auth`. A colecao salva os access tokens somente no ambiente local em memoria e inclui `auth`, `users`, `admin-users`, `occurrences`, `confirmations`, `status`, `departments`, `evaluations`, `notifications`, `internal-ai`, `dashboard`, `webhooks` e `health`. A requisicao de criacao usa [occurrence-example.png](api-client/fixtures/occurrence-example.png) como arquivo local de teste.

Os exemplos de webhook calculam timestamp, identificador e HMAC no script de pre-requisicao usando a biblioteca interna `crypto-js` do Bruno. Preencha somente os segredos ficticios correspondentes no ambiente local; nenhum segredo real e versionado. O roteiro completo da fase atual esta em [docs/FASE10_VALIDACAO.md](docs/FASE10_VALIDACAO.md).

As variaveis preparadas incluem `baseUrl`, os tokens por perfil, IDs de seed, `aiServiceSecret`, `telegramWebhookSecret`, `whatsappWebhookSecret` e `n8nWebhookSecret`. Nenhum token ou segredo real e versionado.

Smoke test pelo Bruno CLI, executado a partir de `api-client`:

```bash
npx --yes @usebruno/cli@3.5.2 run health --env-file environments/local.bru --sandbox=safe
```

O CLI fica fora das dependencias do produto e e usado apenas na validacao da colecao.

## Scripts npm

| Comando                             | Responsabilidade                            |
| ----------------------------------- | ------------------------------------------- |
| `npm run dev`                       | Inicia a API com reinicializacao automatica |
| `npm run build`                     | Compila a aplicacao para `dist`             |
| `npm start`                         | Executa o build de producao                 |
| `npm run lint`                      | Executa ESLint sem alterar arquivos         |
| `npm test`                          | Executa toda a suite de testes              |
| `npm run test:unit`                 | Executa testes unitarios                    |
| `npm run test:integration`          | Executa testes HTTP de integracao           |
| `npm run test:coverage`             | Mede e valida cobertura                     |
| `npm run db:generate`               | Gera migrations com Drizzle Kit             |
| `npm run db:migrate`                | Executa migrations pendentes                |
| `npm run db:seed`                   | Executa o seed permitido no ambiente atual  |
| `npm run db:validate`               | Valida schema, PostGIS, indices e seed      |
| `npm run db:validate:clean`         | Migra, semeia e remove um banco temporario  |
| `npm run db:recalculate-priorities` | Reconcilia contadores e prioridades         |
| `npm run outbox:process`            | Processa manualmente um lote da outbox      |
| `npm run db:studio`                 | Abre Drizzle Studio                         |
| `npm run docker:up`                 | Inicia PostGIS e Adminer                    |
| `npm run docker:down`               | Encerra os containers sem apagar o volume   |
| `npm run docker:build`              | Constroi a imagem final sem privilegios     |
| `npm run docker:config:production`  | Valida o compose com o ambiente de exemplo  |
| `npm run validate`                  | Executa lint, testes e build                |

## Estrutura principal

```text
src/
|-- app.ts
|-- server.ts
|-- config/
|-- database/
|-- docs/
|-- modules/ai/
|-- modules/auth/
|-- modules/confirmations/
|-- modules/dashboard/
|-- modules/departments/
|-- modules/evaluations/
|-- modules/health/
|-- modules/notifications/
|-- modules/outbox/
|-- modules/status/
|-- modules/users/
|-- modules/webhooks/
`-- shared/
tests/
|-- unit/
`-- integration/
drizzle/
api-client/
apps/citizen-web/
docs/
Dockerfile
docker-compose.production.yml
```

`app.ts` monta o Express sem abrir porta, o que permite testes isolados. `server.ts` abre o servidor e implementa desligamento gracioso. O health do banco depende de uma porta de consulta substituivel nos testes, sem esconder a validacao real usada em desenvolvimento. O schema da Fase 1 esta separado por dominio em `src/database/schema`.

## Contratos e deploy

- [Diagrama ER](docs/ERD.md)
- [Contrato da IA](docs/CONTRATO_IA.md)
- [Contrato do painel](docs/CONTRATO_PAINEL.md)
- [Contrato do n8n](docs/CONTRATO_N8N.md)
- [Relatorio de seguranca](docs/RELATORIO_SEGURANCA.md)
- [Limitacoes conhecidas](docs/LIMITACOES.md)
- [Deploy](docs/DEPLOY.md)

O compose local inicia PostGIS e Adminer. O compose de producao e separado, nao publica Adminer ou PostgreSQL e exige um arquivo `.env.production` fora do Git. Consulte o roteiro de deploy antes de executar migrations em qualquer ambiente persistente.

## Solucao de problemas

### Docker Compose informa variaveis ausentes

Crie `.env` a partir de `.env.example` e confirme `POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD`.

### `GET /health/database` retorna 503

Confira:

```bash
docker compose ps
docker compose logs postgres
npm run db:migrate
```

Tambem confirme que `DATABASE_URL` usa `localhost` quando a API roda diretamente no Node. Dentro do Adminer, o servidor deve ser `postgres`.

### Porta em uso

Altere `PORT` para a API ou `POSTGRES_PORT` para a porta publicada do PostgreSQL. Atualize `DATABASE_URL` se a porta do banco mudar.

Por exemplo, se outro PostgreSQL ja usa a porta 5432:

```dotenv
POSTGRES_PORT=5433
DATABASE_URL=postgresql://usuario:senha@127.0.0.1:5433/banco
```

Em algumas configuracoes do Windows, `localhost` pode priorizar IPv6. Se o servico Docker nao responder por esse nome, use `127.0.0.1` na `DATABASE_URL` e para abrir o Adminer, como em http://127.0.0.1:8080.

### Migration falha com credenciais

Confirme que usuario, senha, porta e banco em `DATABASE_URL` correspondem aos valores usados pelo Docker Compose.

### IA retorna fallback `NOT_CONFIGURED`

Preencha `AI_SERVICE_URL` e `AI_SERVICE_SECRET` em conjunto. O provedor deve aceitar `POST /analyze` conforme [docs/FASE7_VALIDACAO.md](docs/FASE7_VALIDACAO.md). Em desenvolvimento, deixar os dois vazios e permitido e preserva a ocorrencia com revisao humana.

### Webhook retorna 401

Confirme os tres cabecalhos `x-webhook-id`, `x-webhook-timestamp` e `x-webhook-signature`. A assinatura e `HMAC-SHA256("timestamp.corpo-bruto", segredo)` no formato `sha256=hex`; qualquer reformatacao do JSON depois do calculo altera a assinatura. O timestamp deve estar dentro da janela configurada.

### Outbox permanece em `PENDING`

Em desenvolvimento, isso e esperado enquanto `N8N_WEBHOOK_URL` estiver vazio. Configure uma URL controlada e o segredo correspondente para iniciar o worker com a API, ou execute `npm run outbox:process` para um lote. Falhas sao reagendadas com backoff ate `OUTBOX_MAX_ATTEMPTS` e depois terminam em `FAILED`.

### API retorna 429

Confira `Retry-After` e os headers `RateLimit-*`. Ajuste `API_RATE_LIMIT_MAX` e `API_RATE_LIMIT_WINDOW_SECONDS` somente de acordo com a capacidade do ambiente. Em multiplas replicas, use rate limit compartilhado no gateway ou WAF.

### Producao recusa as variaveis

Confirme `CORS_ORIGIN` HTTPS, `STORAGE_PROVIDER=s3`, URLs de IA/n8n e segredos distintos sem `CHANGE_ME`. O arquivo `.env.production.example` e propositalmente invalido ate os placeholders serem substituidos.

### Container da API nao fica healthy

Inspecione `docker compose ... logs api`, confirme a migration, a URL do PostgreSQL com host `postgres` e teste `/health/database`. O seed nao pode ser executado com `NODE_ENV=production`.

O roteiro completo, incluindo rotacao/reutilizacao e consultas seguras no Adminer, esta em [docs/FASE2_VALIDACAO.md](docs/FASE2_VALIDACAO.md).

## Limitacoes declaradas

As limitacoes funcionais, operacionais e de infraestrutura estao consolidadas em [docs/LIMITACOES.md](docs/LIMITACOES.md). As Fases 0 a 9 foram aprovadas; a Fase 10 esta em validacao final e depende da aprovacao explicita do usuario.
