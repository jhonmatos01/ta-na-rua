# Checklist mestre - Ta na Rua!

Fonte de verdade: PRD Tecnico Consolidado v1.2, de 18 de julho de 2026.

## Resumo das fases

- [x] Fase 0 - Inicializacao
- [x] Fase 1 - Banco de dados
- [x] Fase 2 - Autenticacao e usuarios
- [x] Fase 3 - Ocorrencias, imagens e localizacao
- [x] Fase 4 - Confirmacoes e prioridade
- [x] Fase 5 - Status, historico e departamentos
- [x] Fase 6 - Avaliacoes e contestacao
- [x] Fase 7 - Integracao com IA
- [x] Fase 8 - Dashboard e indicadores
- [x] Fase 9 - Webhooks e n8n
- [~] Fase 10 - Finalizacao e deploy

## Fase 0 - Inicializacao

Estado: concluida e aprovada pelo usuario em 18 de julho de 2026.

### Projeto e dependencias

- [x] Criar `package.json` e definir a versao do Node.js.
- [x] Instalar dependencias de producao e desenvolvimento.
- [x] Criar scripts obrigatorios, incluindo `validate`.
- [x] Criar `.gitignore` e `.env.example` sem segredos reais.

### TypeScript e Express

- [x] Ativar TypeScript estrito e configurar origem e build.
- [x] Criar aplicacao e servidor Express.
- [x] Configurar JSON, limite de payload, CORS e Helmet.
- [x] Implementar request ID e respostas padronizadas.
- [x] Implementar tratamento centralizado de erros e rota inexistente.
- [x] Implementar desligamento gracioso.
  - Evidencia: teste automatizado confirma encerramento unico do servidor e do pool.

### Ambiente e logs

- [x] Validar variaveis de ambiente com Zod.
- [x] Impedir inicializacao com ambiente invalido.
- [x] Configurar Pino com protecao de campos sensiveis.
  - Evidencia: teste automatizado confirma a redacao de senha, refresh token e cabecalho Authorization.

### PostgreSQL, PostGIS, Drizzle e Adminer

- [x] Criar Docker Compose com PostGIS, volume e healthcheck.
  - Evidencia: Docker 29.6.1 iniciou PostGIS e Adminer; o container PostgreSQL atingiu o estado `healthy`.
- [x] Adicionar Adminer na porta 8080.
  - Evidencia: login realizado com sucesso e os schemas `public` e `drizzle` foram inspecionados pela interface.
- [x] Configurar Drizzle e o pool PostgreSQL.
  - Evidencia: API e scripts conectaram ao PostgreSQL do Docker com sucesso.
- [x] Criar migration versionada para habilitar PostGIS.
  - Evidencia: `npm run db:migrate` foi executado duas vezes sem erro; a tabela `drizzle.__drizzle_migrations` contem um registro.
- [x] Criar seed inicial limitado ao escopo da Fase 0.
  - Evidencia: `npm run db:seed` foi executado duas vezes sem criar tabelas de dominio futuras.
- [x] Confirmar conexao e extensao PostGIS.
  - Evidencia: PostGIS 3.5.2 foi confirmado no banco; o health da API retornou a versao 3.5 e HTTP 200.

### Health e Swagger

- [x] Implementar `GET /health`.
- [x] Implementar `GET /health/database`, incluindo resposta 503.
- [x] Disponibilizar Swagger UI em `/docs`.
- [x] Disponibilizar OpenAPI em `/docs/openapi.json`.
- [x] Documentar health, erros e esquema JWT Bearer.

### Testes, colecao e documentacao

- [x] Configurar Vitest, Supertest e cobertura.
- [x] Testar health, banco, request ID, 404 e banco indisponivel.
- [x] Configurar ESLint e Prettier.
- [x] Criar colecao Bruno para as rotas da fase.
  - Evidencia: colecao e ambiente local foram criados e versionados; as mesmas rotas foram executadas com sucesso pelo Swagger.
- [x] Criar README com roteiro manual, Swagger, Adminer e comandos.
- [x] Executar lint, testes, cobertura, build e validate.
- [x] Validar API, Swagger, Adminer, PostgreSQL e PostGIS em execucao.
  - Evidencia: API, OpenAPI, Swagger, Adminer, migration, seed e health do banco foram validados em execucao.
- [x] Obter aprovacao explicita do usuario.
  - Evidencia: o usuario escreveu "Aprovo a Fase 0 e autorizo o planejamento e implementacao da Fase 1".

## Evidencias

- [x] Checklist criado antes da implementacao.
  - Evidencia: este arquivo registra a Fase 0 como em desenvolvimento e mantem as fases seguintes nao iniciadas.
- [x] Validacao automatizada da Fase 0.
  - Evidencia: `npm run validate` terminou com codigo zero; 6 arquivos e 14 testes passaram; o build TypeScript terminou sem erros.
- [x] Cobertura automatizada.
  - Evidencia: statements 90,17%, branches 82,50%, functions 81,48% e lines 90,99%.
- [x] Formatacao.
  - Evidencia: `npm run format:check` terminou com todos os arquivos compativeis com Prettier.
- [x] API e Swagger em execucao.
  - Evidencia: `GET /health` retornou 200 com request ID; OpenAPI retornou 200; Swagger executou `GET /health` e `GET /health/database` com HTTP 200.
- [x] Docker, PostgreSQL, PostGIS e Adminer.
  - Evidencia: containers subiram; PostgreSQL ficou `healthy`; PostGIS 3.5.2 foi confirmado; o login no Adminer exibiu a migration no schema `drizzle`.
- [x] Migration e seed idempotentes.
  - Evidencia: ambos os comandos foram executados duas vezes sem erro e sem introduzir entidades de fases futuras.
- [x] Auditoria das dependencias de producao.
  - Evidencia: `npm audit --omit=dev` encontrou zero vulnerabilidades.
- [~] Auditoria completa das dependencias.
  - Evidencia: quatro alertas moderados existem somente na cadeia de desenvolvimento do Drizzle Kit (`@esbuild-kit`/`esbuild`). A correcao automatica exige uma alteracao incompativel e nao foi aplicada.
- [x] Validacao com servicos locais.
  - Evidencia: a instancia Docker foi publicada na porta local 5433 porque um PostgreSQL do Windows ja ocupa a 5432; o `.env` local ignorado pelo Git usa `127.0.0.1:5433` e os padroes versionados continuam em 5432.

## Resumo da Fase 0

- Itens concluidos: 32
- Itens em desenvolvimento: 0
- Itens bloqueados: 0
- Itens nao iniciados: 0
- Progresso estimado: 100%

## Fase 1 - Banco de dados

Estado: concluida e aprovada pelo usuario em 18 de julho de 2026.

### Enums e tabelas

- [x] Criar enums de perfis, status de usuario e ocorrencia, risco, origem, tipo de imagem, moderacao, IA, notificacao, webhook e outbox.
  - Evidencia: 11 enums foram criados pela migration e conferidos no PostgreSQL e no Adminer.
- [x] Criar `municipalities`, `neighborhoods`, `categories`, `departments`, `users`, `refresh_tokens`, `occurrences`, `occurrence_reports`, `occurrence_images`, `occurrence_confirmations`, `occurrence_status_history`, `repair_evaluations`, `ai_analyses`, `notifications`, `audit_logs`, `webhook_events`, `outbox_events` e `protocol_counters`.
  - Evidencia: `npm run db:validate` e o Adminer confirmaram as 18 tabelas definitivas.

### Relacionamentos, constraints e indices

- [x] Criar chaves estrangeiras e restricoes unicas.
  - Evidencia: o banco possui 53 constraints de check, chave estrangeira e unicidade no conjunto validado.
- [x] Criar checks de coordenadas, notas, gravidade, confianca e contadores.
  - Evidencia: PostgreSQL rejeitou `confirmation_count = -1` e `rating = 6` com as constraints esperadas.
- [x] Impedir autorreferencia de duplicidade.
  - Evidencia: PostgreSQL rejeitou `duplicate_of_occurrence_id = id` com `occurrences_duplicate_self_chk`.
- [x] Configurar exclusao logica e timestamps em UTC.
  - Evidencia: entidades aplicaveis possuem `deleted_at`; datas definitivas usam `TIMESTAMPTZ`.
- [x] Criar indices de e-mail, telefone, protocolo, municipio, bairro, categoria, status, data, GiST, confirmacoes e dashboard.
  - Evidencia: `npm run db:validate` confirmou os indices obrigatorios; o Adminer exibiu os indices de `occurrences`, incluindo o GiST de localizacao.

### Migrations e seeds

- [x] Criar migration inicial das tabelas preservando a migration versionada do PostGIS.
  - Evidencia: `drizzle/0001_clean_dorian_gray.sql` foi criada sem editar `0000_enable-postgis.sql`.
- [x] Executar migrations e conferir no Adminer.
  - Evidencia: `npm run db:migrate` foi executado duas vezes sem erro; as tabelas foram exibidas no Adminer.
- [x] Criar municipios, bairros, categorias, departamentos, usuarios preparados, ocorrencias, historicos, confirmacoes, notificacoes e avaliacoes ficticias.
  - Evidencia: o validador confirmou 2 municipios, 3 bairros, 11 categorias, 3 departamentos, 3 usuarios preparados e os cenarios relacionados.
- [x] Tornar o seed idempotente e bloqueado em producao.
  - Evidencia: o seed foi repetido sem duplicacoes; teste automatizado confirma o bloqueio em `production`.
- [x] Executar `npm run db:seed`.
  - Evidencia: comando executado duas vezes com codigo zero e PostGIS confirmado.

### Validacao

- [x] Conferir tabelas, relacionamentos, indices, PostGIS e seeds no Adminer.
  - Evidencia: consulta executada no Adminer retornou 18 tabelas, 11 enums, 53 constraints, 2 indices GiST, 11 categorias, 3 usuarios, 2 ocorrencias, 0 refresh tokens e PostGIS 3.5.
- [x] Aprovar testes, Swagger, colecao, README, cobertura, build e `npm run validate`.
  - Evidencia: 7 arquivos e 17 testes passaram; cobertura atingiu 90,43% statements, 83,33% branches, 82,14% functions e 91,22% lines; formatacao, build e validate passaram; auditoria de producao encontrou zero vulnerabilidades.
- [x] Obter aprovacao explicita do usuario.
  - Evidencia: o usuario escreveu "Aprovo a Fase 1 e autorizo o planejamento e implementacao da Fase 2".

### Plano tecnico

- Organizar o schema Drizzle por dominio e exporta-lo por um indice central.
- Utilizar UUID gerado no PostgreSQL, `TIMESTAMPTZ`, `snake_case` e enums `UPPER_SNAKE_CASE`.
- Preservar `drizzle/0000_enable-postgis.sql`; toda evolucao sera uma nova migration.
- Manter senhas e sessoes apenas como dados preparados, sem simular autenticacao funcional antes da Fase 2.
- Usar seed deterministico com `ON CONFLICT`, seguro para repeticao e proibido em producao.

## Resumo da Fase 1

- Itens concluidos: 15
- Itens em desenvolvimento: 0
- Itens bloqueados: 0
- Itens nao iniciados: 0
- Progresso estimado: 100%

## Fase 2 - Autenticacao e usuarios

Estado: concluida e aprovada pelo usuario.

### Usuarios e credenciais

- [x] Implementar cadastro com validacao de e-mail, telefone normalizado e municipio valido.
  - Evidencia: testes HTTP cobrem cadastro valido, telefone normalizado e municipio invalido com HTTP 422.
- [x] Impedir que o cidadao escolha o proprio perfil e tratar duplicidade com HTTP 409.
  - Evidencia: corpo com `role` e rejeitado; e-mail ou telefone duplicado retorna `USER_ALREADY_EXISTS`.
- [x] Armazenar senhas exclusivamente com Argon2id.
  - Evidencia: seed, repositorio e Adminer confirmaram 7 usuarios e 7 hashes com prefixo `$argon2id$`, sem exibir o valor integral.
- [x] Implementar leitura, atualizacao e exclusao logica do proprio perfil.
  - Evidencia: `GET`, `PATCH` e `DELETE /api/v1/users/me` foram implementados e testados; exclusao grava `DELETED`/`deleted_at`.

### Login, tokens e sessoes

- [x] Implementar login com access token JWT curto e refresh token opaco.
  - Evidencia: execucao real retornou JWT de 15 minutos com `jti` unico e refresh aleatorio de 32 bytes.
- [x] Armazenar somente o hash do refresh token e entrega-lo em cookie `httpOnly`.
  - Evidencia: Adminer confirmou hashes SHA-256 de 64 caracteres; testes confirmaram ausencia do refresh no JSON e flags do cookie.
- [x] Implementar rotacao do refresh e detectar reutilizacao de token revogado.
  - Evidencia: rotacao gerou JWT distinto; reutilizacao real retornou HTTP 401 `REFRESH_TOKEN_REUSE_DETECTED` e revogou a familia.
- [x] Implementar logout, revogacao, alteracao de senha e `GET /api/v1/auth/me`.
  - Evidencia: todas as rotas foram implementadas, documentadas e exercitadas por testes HTTP.
- [x] Revogar todas as sessoes anteriores apos alteracao de senha ou exclusao da conta.
  - Evidencia: testes confirmaram `SESSION_REVOKED` imediatamente apos ambas as operacoes.

### Middlewares e perfis

- [x] Implementar `authenticate`, incluindo token ausente, invalido, expirado e usuario bloqueado.
  - Evidencia: testes cobrem `AUTHENTICATION_REQUIRED`, `INVALID_ACCESS_TOKEN`, `ACCESS_TOKEN_EXPIRED`, `SESSION_REVOKED` e `USER_BLOCKED`.
- [x] Implementar `authorizeRoles`, `authorizeMunicipality` e autorizacao de proprietario.
  - Evidencia: testes cobrem perfil negado/permitido, segundo municipio, moderador global e proprietario correto/incorreto.
- [x] Criar seeds idempotentes de todos os perfis, segundo municipio, usuario bloqueado e sessao revogada.
  - Evidencia: seed executado duas vezes; validador confirmou 7 usuarios, 4 perfis, 2 municipios, 1 bloqueado e refresh revogado.

### Documentacao e testes

- [x] Documentar todas as rotas da fase no Swagger e habilitar o fluxo real do botao Authorize.
  - Evidencia: OpenAPI 0.3.0 publica 13 caminhos; login pelo Try it out retornou HTTP 200 e o servidor relativo `/` eliminou divergencia `localhost`/`127.0.0.1`.
- [x] Testar HTTP 401, 403, 409 e 422, perfis, outro municipio, revogacao e reutilizacao de refresh.
  - Evidencia: 9 arquivos e 31 testes passaram, incluindo os codigos e cenarios obrigatorios.
- [x] Atualizar matriz de permissoes, colecao Bruno, README e roteiro de validacao; executar `npm run validate` e obter aprovacao explicita.
  - Evidencia: README, matriz, 13 requisicoes Bruno e `docs/FASE2_VALIDACAO.md` foram atualizados; lint, 31 testes, build, cobertura, formatacao, banco e auditoria passaram. O usuario escreveu "Aprovo a Fase 2 e autorizo o planejamento e implementacao da Fase 3".

### Plano tecnico

- Separar os modulos `auth` e `users` em contratos, repositorios, servicos, controladores e rotas.
- Usar Argon2id para senha, JWT assinado para access token e 32 bytes aleatorios com hash SHA-256 para refresh token.
- Representar cada familia de refresh tokens pelo `session_id`; a reutilizacao revoga toda a familia.
- Verificar usuario e sessao ativa no middleware de autenticacao para que bloqueio, exclusao e troca de senha tenham efeito imediato.
- Validar entradas com Zod e manter respostas, erros e auditoria sem dados sensiveis.
- Testar o contrato HTTP com servicos substituiveis e validar o repositorio real contra PostgreSQL/PostGIS local.

## Resumo da Fase 2

- Itens concluidos: 15
- Itens em desenvolvimento: 0
- Itens bloqueados: 0
- Itens nao iniciados: 0
- Progresso estimado: 100%

## Fase 3 - Ocorrencias, imagens e localizacao

Estado: concluida e aprovada pelo usuario em 19 de julho de 2026.

### Ocorrencias

- [x] Implementar criacao transacional com protocolo anual atomico, estado `PENDING_REVIEW`, primeiro relato, historico e auditoria.
  - Evidencia: criacao real gravou protocolo, ocorrencia, relato, imagem, historico, auditoria e notificacao; quatro criacoes concorrentes produziram protocolos unicos.
- [x] Implementar detalhes, listagens, filtros, paginacao, ocorrencias proprias, exclusao logica e privacidade publica.
  - Evidencia: 9 operacoes HTTP cobrem lista, detalhe, proximidade, mapa, proprias, atualizacao, imagem, linha do tempo e exclusao logica; paginacao fica em `meta`.

### Imagens

- [x] Implementar abstracao de armazenamento S3 compativel e adaptador local de desenvolvimento.
  - Evidencia: `ImageStorage` possui adaptadores `LocalImageStorage` e `S3ImageStorage`; producao exige bucket e credenciais validadas.
- [x] Implementar multipart, JPEG/PNG/WebP, verificacao do MIME real, tamanho e quantidade configuraveis, chave aleatoria, metadados e limpeza de orfaos.
  - Evidencia: testes cobrem tres assinaturas, MIME divergente, arquivo invalido, 8 MB, maximo de 5, bloqueio transacional contra uploads concorrentes e remocao apos falha.
- [x] Documentar o upload executavel no Swagger.
  - Evidencia: Swagger 0.4.0 apresenta seletor binario multipart e retornou HTTP 201 no `Try it out` real.

### Localizacao

- [x] Utilizar ponto PostGIS e indice espacial da Fase 1 para consultas geograficas.
  - Evidencia: Adminer e validador confirmaram `ST_Point`, SRID 4326 e indices GiST em ocorrencias e relatos.
- [x] Implementar `ST_DWithin`, raio configuravel, proximidade e dados para mapa.
  - Evidencia: consulta real a 50 metros retornou uma ocorrencia e distancia zero no ponto do seed; `nearby` ordena por distancia.
- [x] Validar coordenadas e municipio e aplicar arredondamento e remocao de endereco sensivel na resposta publica.
  - Evidencia: testes e HTTP real confirmaram 404 para pendencia publica, ausencia de autor, quatro casas decimais e endereco sem numero/complemento.

### Testes e validacao

- [x] Testar criacao valida, imagem ausente, coordenadas, MIME, tamanho, autenticacao, 404, paginacao, filtros, proximidade, privacidade e isolamento municipal.
  - Evidencia: 12 arquivos e 55 testes passaram; cobertura atingiu 84,37% statements, 77,04% branches, 88,27% functions e 85,04% lines.
- [x] Testar upload pelo Swagger e conferir ocorrencia, relato, imagem, localizacao, historico e auditoria no Adminer.
  - Evidencia: Swagger criou `TNR-2026-000009` com HTTP 201; Adminer mostrou `POINT(-38.5016 -12.9777)`, um relato, uma imagem, um historico e uma auditoria.
- [x] Atualizar documentacao, colecao Bruno e README; aprovar `npm run validate` e obter aprovacao explicita do usuario.
  - Evidencia: README, `docs/FASE3_VALIDACAO.md`, 10 requisicoes de ocorrencias, dois logins de perfil e arquivo PNG foram adicionados; `npm run validate`, cobertura, banco, formatacao e auditoria de producao passaram. O usuario escreveu "Aprovo a Fase 3 e autorizo o planejamento e implementacao da Fase 4".

### Plano tecnico

- Criar um modulo `occurrences` separado em contratos, repositorio PostgreSQL/PostGIS, servico, controlador e rotas.
- Gerar o protocolo `TNR-AAAA-NNNNNN` por contador anual bloqueado dentro da mesma transacao da ocorrencia.
- Manter a imagem inicial obrigatoria e armazenar somente chave aleatoria, URL e metadados tecnicos no banco.
- Oferecer armazenamento local no ambiente de desenvolvimento e uma implementacao S3 compativel para producao, sob a mesma interface.
- Centralizar a serializacao publica para nunca expor autor, numero residencial, complemento ou coordenadas exatas.
- Colocar `nearby`, `map` e `mine` antes de `/:id` para evitar colisao de rotas.
- Preservar mudancas de status e integracao com IA para as fases 5 e 7; nesta fase toda nova ocorrencia nasce em `PENDING_REVIEW`.

## Resumo da Fase 3

- Itens concluidos: 11
- Itens em desenvolvimento: 0
- Itens bloqueados: 0
- Itens nao iniciados: 0
- Progresso estimado: 100%

## Fase 4 - Confirmacoes e prioridade

Estado: concluida e aprovada pelo usuario em 19 de julho de 2026.

### Confirmacoes

- [x] Implementar criacao, remocao da propria confirmacao e consulta da contagem.
  - Evidencia: `POST`, `DELETE` e `GET /api/v1/occurrences/:id/confirmations*` foram implementados e exercitados por testes HTTP.
- [x] Restringir a mutacao ao perfil `CITIZEN` autenticado e manter a contagem publica.
  - Evidencia: defesa em profundidade nas rotas e no servico retorna 403 para perfis operacionais; a consulta publica retorna somente contagem e prioridade.
- [x] Impedir confirmacao duplicada no banco e no servico.
  - Evidencia: a restricao unica e `ON CONFLICT DO NOTHING` retornaram HTTP 409 `CONFIRMATION_ALREADY_EXISTS`; duas requisicoes concorrentes produziram exatamente HTTP 201 e 409.

### Consistencia e prioridade

- [x] Atualizar confirmacao, contador e prioridade na mesma transacao bloqueada, sem permitir contador negativo.
  - Evidencia: a ocorrencia e bloqueada com `FOR UPDATE`; o contador e recalculado por `COUNT(*)` antes do commit.
- [x] Centralizar exclusivamente no `PriorityService` a formula do PRD e recalcular depois de incluir ou remover confirmacao.
  - Evidencia: testes unitarios cobrem pesos, limites, arredondamento, dados ausentes e alteracao do score nas duas mutacoes.
- [x] Tratar `occurrence_confirmations` como fonte oficial e criar rotina administrativa de reconciliacao.
  - Evidencia: `npm run db:recalculate-priorities` processou 2 ocorrencias, sem divergencias; `npm run db:validate` confirmou 2 contadores e 2 prioridades validos.

### Notificacoes, auditoria e visibilidade

- [x] Notificar o autor e auditar a primeira confirmacao e a remocao.
  - Evidencia: validacao real confirmou notificacao `OCCURRENCE_CONFIRMED` e auditorias de inclusao/remocao, todas na mesma transacao da mutacao.
- [x] Preservar a privacidade de ocorrencias pendentes/rejeitadas e informar `confirmedByMe` somente quando autenticado.
  - Evidencia: testes HTTP cobrem 404 publico, acesso do autor/operacao autorizada e ausencia do campo na consulta anonima.

### Contrato e validacao

- [x] Atualizar OpenAPI 0.5.0, colecao Bruno, README e roteiro de validacao.
  - Evidencia: tres operacoes de confirmacao foram documentadas no Swagger e adicionadas a pasta `api-client/confirmations`.
- [x] Executar os testes obrigatorios, concorrencia real, Swagger, Adminer, cobertura, banco, formatacao, build e auditoria.
  - Evidencia: 15 arquivos e 74 testes passaram; Swagger retornou HTTP 200; Adminer mostrou contador armazenado 1, fonte oficial 1 e prioridade 27,32; cobertura de linhas atingiu 86,04%; zero vulnerabilidades de producao.
- [x] Obter aprovacao explicita do usuario.
  - Evidencia: o usuario escreveu "Aprovo a Fase 4 e autorizo o planejamento e implementacao da Fase 5".

### Plano tecnico

- Manter confirmacoes em modulo proprio, separado em schemas, contratos, repositorio PostgreSQL, servico e rotas.
- Bloquear a ocorrencia antes de alterar confirmacoes e derivar sempre o contador da tabela oficial dentro da mesma transacao.
- Manter toda a formula de prioridade no `PriorityService`, com os pesos definidos no PRD e arredondamento em duas casas.
- Recalcular a prioridade nas duas mutacoes e disponibilizar um comando idempotente para reconciliacao administrativa.
- Registrar notificacao e auditoria dentro da transacao, sem expor comentario ou identidade na resposta publica.
- Preservar mudancas de status para a Fase 5 e classificacao/duplicidade semantica por IA para a Fase 7.

## Resumo da Fase 4

- Itens concluidos: 11
- Itens em desenvolvimento: 0
- Itens bloqueados: 0
- Itens nao iniciados: 0
- Progresso estimado: 100%

## Fase 5 - Status, historico e departamentos

Estado: concluida e aprovada pelo usuario em 19 de julho de 2026.

### Checklist do PRD

- [x] Implementar CRUD, ativacao de departamentos e isolamento municipal.
  - Evidencia: cinco operacoes HTTP cobrem lista/criacao, detalhe/edicao/inativacao e ativacao; operador do segundo municipio recebeu HTTP 403.
- [x] Criar maquina de estados com todas as 24 transicoes definitivas.
  - Evidencia: `status-machine.ts` declara a matriz completa do PRD e o teste percorre todas as 144 combinacoes possiveis.
- [x] Impedir transicoes invalidas com HTTP 409 `INVALID_STATUS_TRANSITION`.
  - Evidencia: tentativa real `PUBLISHED -> RESOLVED` retornou 409 sem gerar historico, auditoria ou notificacao.
- [x] Validar perfil, municipio e campos obrigatorios por transicao.
  - Evidencia: testes cobrem cidadao, operador, moderador, administrador, outro municipio, departamento, previsao, agendamento, descricao e motivo.
- [x] Implementar atribuicao, previsao, agendamento, inicio, resolucao, fechamento, contestacao e reabertura.
  - Evidencia: fluxo real percorreu nove transicoes ate reabrir em `IN_PROGRESS`, preservou agendamento, limpou datas de conclusao e recalculou prioridade para 27,35.
- [x] Criar historico, auditoria e notificacoes dentro da mesma transacao.
  - Evidencia: fluxo real produziu 9 historicos, 10 auditorias e 20 notificacoes; duas transicoes concorrentes retornaram HTTP 200/409.
- [x] Testar todos os perfis, outro municipio, rollback e registros gerados.
  - Evidencia: 19 arquivos e 100 testes passaram; validacao real confirmou HTTP 403 entre municipios, rollback integral e protecao do motivo no historico publico.
- [x] Conferir Adminer, Swagger, matriz de permissoes, colecao Bruno e README.
  - Evidencia: Swagger 0.6.0 respondeu o historico com HTTP 200; Adminer mostrou seed restaurado, 3 departamentos ativos e 0 atribuicoes invalidas; README e nove requisicoes Bruno foram atualizados.
- [x] Aprovar `npm run validate` e obter aprovacao explicita do usuario.
  - Evidencia: `npm run validate`, cobertura, banco, formatacao e auditoria de producao passaram. O usuario escreveu "Aprovo a Fase 5 e autorizo o planejamento e implementacao da Fase 6".

### Plano tecnico

- Criar modulo `departments` com rotas administrativas, unicidade por municipio, ativacao e exclusao logica por inativacao.
- Criar modulo `status` com a maquina de estados isolada do controller e tabela explicita de transicoes e permissoes.
- Bloquear a ocorrencia com `FOR UPDATE` e validar existencia, status atual, perfil, municipio, departamento e campos antes de qualquer gravacao.
- Usar os campos definitivos de atendimento ja presentes em `occurrences`: `assigned_department_id`, `assigned_by`, `assigned_at`, `expected_resolution_at`, `scheduled_for`, `resolution_description`, `resolved_at`, `resolved_by`, `closed_at` e `closed_by`.
- Exigir departamento ativo do mesmo municipio ao encaminhar; exigir agendamento futuro para `SCHEDULED` e descricao de resolucao para `RESOLVED`.
- Inserir historico, auditoria e notificacoes na mesma transacao da ocorrencia, garantindo rollback integral.
- Recalcular prioridade ao reabrir uma ocorrencia, conforme a regra definitiva da Fase 4.
- Preservar contestacao automatica por avaliacoes para a Fase 6 e sugestao semantica por IA para a Fase 7; a decisao administrativa de duplicidade pertence a maquina desta fase.

## Resumo da Fase 5

- Itens concluidos: 9
- Itens em desenvolvimento: 0
- Itens bloqueados: 0
- Itens nao iniciados: 0
- Progresso estimado: 100%

## Fase 6 - Avaliacoes e contestacao

Estado: concluida e aprovada pelo usuario em 19 de julho de 2026.

### Checklist do PRD

- [x] Implementar criacao, notas, relacao do usuario, status permitido e unicidade.
  - Evidencia: criacao real retornou HTTP 201; duplicidade retornou 409, usuario nao relacionado 403, status invalido 409 e nota invalida 422.
- [x] Permitir edicao no prazo configurado e disponibilizar resumo.
  - Evidencia: prazo de sete dias e configuravel; edicao expirada retornou 409 e o resumo publico omite comentarios e identificadores pessoais.
- [x] Calcular proporcao negativa e quantidade minima de avaliacoes.
  - Evidencia: tres avaliacoes, duas negativas, produziram 66,67%; os padroes validados sao minimo 3 e limiar 50%.
- [x] Alterar automaticamente para `CONTESTED` ou encaminhar para revisao administrativa.
  - Evidencia: exatamente uma de duas respostas concorrentes sinalizou a contestacao e o banco persistiu um unico status `CONTESTED`.
- [x] Criar historico, auditoria e notificacoes dentro da mesma transacao.
  - Evidencia: o fluxo real criou um historico automatico, quatro auditorias de avaliacao, uma auditoria de contestacao e 11 notificacoes.
- [x] Testar avaliacao valida, duplicada, usuario nao relacionado, status invalido, nota, prazo, contestacao e reabertura.
  - Evidencia: 22 arquivos e 119 testes passaram; o fluxo PostgreSQL real cobriu todos os casos, concorrencia e `CONTESTED -> IN_PROGRESS`.
- [x] Conferir Adminer, Swagger, colecao Bruno e README.
  - Evidencia: Swagger 0.7.0 retornou HTTP 200; Adminer mostrou o seed com nota 5 e qualidade 4; quatro requisicoes Bruno e `docs/FASE6_VALIDACAO.md` foram adicionados.
- [x] Aprovar `npm run validate` e obter aprovacao explicita do usuario.
  - Evidencia: validate, cobertura, banco e inspecoes visuais passaram. O usuario escreveu "aprovo a Fase 6 e autorizo o planejamento e implementacao da Fase 7".

### Plano tecnico

- Criar o modulo `evaluations` com as quatro rotas definitivas do PRD: criacao, listagem, resumo e edicao da propria avaliacao.
- Aceitar avaliacoes apenas de `CITIZEN` relacionado por criacao/report ou confirmacao e somente quando a ocorrencia estiver em `RESOLVED` ou `CLOSED`.
- Aplicar `UNIQUE (occurrence_id, user_id)`, notas de 1 a 5, qualidade opcional de 1 a 5 e comentarios limitados.
- Permitir edicao por sete dias contados da criacao, usando configuracao de ambiente validada.
- Considerar negativa a avaliacao com `problem_resolved = false`; contestar automaticamente com pelo menos tres avaliacoes e proporcao negativa maior ou igual a 50%.
- Bloquear a ocorrencia com `FOR UPDATE` e manter avaliacao, eventual mudanca para `CONTESTED`, historico, auditoria e notificacoes na mesma transacao.
- Manter a reabertura operacional de `CONTESTED -> IN_PROGRESS` no modulo de status criado na Fase 5.
- Restringir detalhes individuais a cidadaos relacionados e perfis operacionais autorizados, preservando o resumo publico sem dados pessoais.

## Resumo da Fase 6

- Itens concluidos: 8
- Itens em desenvolvimento: 0
- Itens bloqueados: 0
- Itens nao iniciados: 0
- Progresso estimado: 100%

## Fase 7 - Integracao com IA

Estado: concluida e aprovada pelo usuario em 20 de julho de 2026.

### Checklist do PRD

- [x] Criar cliente HTTP com URL, segredo, timeout e tentativas.
  - Evidencia: cliente validado com timeout configuravel, no maximo duas tentativas totais e chave idempotente por report.
- [x] Proteger segredo e tratar indisponibilidade/resposta invalida.
  - Evidencia: segredo permanece no cabecalho redigido dos logs; indisponibilidade, timeout e resposta invalida geram fallback persistido.
- [x] Enviar report, imagem, descricao, localizacao, proximas e categorias.
  - Evidencia: validacao HTTP real confirmou o contrato sem dados pessoais, o segredo e a chave idempotente.
- [x] Validar categoria, subcategoria, gravidade, risco, confianca, revisao e duplicidades.
  - Evidencia: Zod e regras de dominio rejeitam classificacao ou duplicidade fora do contexto enviado.
- [x] Salvar resposta bruta e validada.
  - Evidencia: `raw_result` armazena estado, tentativas e respostas redigidas; a classificacao validada fica em colunas proprias.
- [x] Aplicar fallback e manter ocorrencia registrada.
  - Evidencia: a ocorrencia e confirmada antes da chamada externa e continuou registrada nos cenarios de timeout e indisponibilidade.
- [x] Impedir acesso direto ao banco, alteracao de status e fusao automatica.
  - Evidencia: a IA recebe apenas DTO; validacao PostgreSQL confirmou historico inalterado, status preservado e `duplicate_of_occurrence_id` nulo.
- [x] Testar valido, invalido, timeout, indisponibilidade, confianca baixa, duplicidade, retry e fallback.
  - Evidencia: os oito cenarios foram exercitados; a suite final aprovou 141 testes em 25 arquivos.
- [x] Conferir Adminer e documentacao.
  - Evidencia: registro semente conferido visualmente no Adminer; Swagger 0.8.0, Bruno, README e `docs/FASE7_VALIDACAO.md` atualizados.
- [x] Aprovar `npm run validate` e obter aprovacao explicita do usuario.
  - Evidencia: `npm run validate`, `npm run db:validate`, `npm run format:check` e `npm audit --omit=dev` aprovados; o usuario aprovou a Fase 7 em 19 de julho de 2026.

### Plano tecnico

- Criar modulo `ai` separado em schemas Zod, contrato, cliente HTTP, servico, repositorio PostgreSQL e rotas internas.
- Gravar a ocorrencia e a imagem antes da chamada externa; nenhuma falha da IA podera desfazer a criacao confirmada.
- Enviar somente report, imagem, descricao, coordenadas, ocorrencias proximas e lista de categorias ativas, sem identidade do cidadao ou segredo.
- Usar `AI_SERVICE_URL`, segredo em cabecalho, timeout de 8 segundos, duas tentativas totais e `reportId` como chave idempotente.
- Validar primeiro a estrutura com Zod e depois a coerencia com categorias e candidatos realmente enviados.
- Persistir sucesso ou fallback em `ai_analyses`, sempre com estado e sem campos sensiveis no `raw_result`.
- Aplicar categoria, gravidade, risco e prioridade apenas com confianca suficiente; nunca alterar status ou decidir duplicidade automaticamente.
- Marcar baixa confianca, solicitacao explicita ou duplicidade acima do limiar como revisao humana.
- Proteger as tres rotas internas do PRD com comparacao constante de `x-ai-service-secret`.
- Preservar dashboard e indicadores para a Fase 8.

## Resumo da Fase 7

- Itens concluidos: 10
- Itens em desenvolvimento: 0
- Itens bloqueados: 0
- Itens nao iniciados: 0
- Progresso estimado: 100%

## Fase 8 - Dashboard e indicadores

Estado: concluida e aprovada pelo usuario em 20 de julho de 2026.

### Checklist do PRD

- [x] Implementar resumo, categoria, bairro, status, prioridade, resolucao, mapa de calor e exportacao do MVP.
  - Evidencia: os oito endpoints responderam HTTP 200 com PostgreSQL real e contratos documentados.
- [x] Aplicar filtros de periodo, categoria, bairro, status, municipio e perfil.
  - Evidencia: filtros combinados retornaram uma ocorrencia, periodo vazio retornou zero, cidadao e operador fora do municipio receberam HTTP 403.
- [x] Proteger dados pessoais, evitar N+1 e criar indices.
  - Evidencia: ranking e CSV nao incluem identidade, contato, descricao, endereco ou coordenada exata; agregacoes executam SQL direto e a migration 0002 criou dois indices compostos.
- [x] Testar dados vazios, filtros, agregacoes, municipios, perfis, desempenho e exportacao.
  - Evidencia: nove testes da fase e a validacao HTTP real cobriram os cenarios; as oito requisicoes levaram 148,13 ms no banco local.
- [x] Comparar resultados com o Adminer.
  - Evidencia: o Adminer confirmou 2 ocorrencias, 1 ativa, 1 resolvida, 1 confirmacao, prioridade media 21,45, resolucao media de 30 horas e os 2 indices da fase.
- [x] Atualizar Swagger, colecao Bruno e README.
  - Evidencia: Swagger 0.9.0 conferido visualmente com 8 rotas e 6 schemas; 9 requisicoes Bruno, README e `docs/FASE8_VALIDACAO.md` atualizados.
- [x] Aprovar `npm run validate` e obter aprovacao explicita do usuario.
  - Evidencia: `npm run validate`, `npm run test:coverage`, `npm run db:validate`, `npm run format:check` e `npm audit --omit=dev` aprovados; o usuario aprovou a Fase 8 em 20 de julho de 2026 com a mensagem "aprovado".

### Plano tecnico

- Criar modulo `dashboard` separado em schemas Zod, tipos, repositorio PostgreSQL, servico e rotas.
- Restringir o painel a `CITY_OPERATOR`, `MODERATOR` e `ADMIN`; o operador ficara sempre limitado ao municipio do token.
- Reutilizar filtros parametrizados de periodo, categoria, bairro, status e municipio em todos os indicadores.
- Executar agregacoes diretamente no PostgreSQL, sem consultas por item, e apoiar o periodo e a resolucao com indices compostos.
- Retornar somente dados operacionais agregados; o ranking e a exportacao nao incluirao usuario, contato, descricao, endereco ou coordenada exata.
- Gerar mapa de calor por celulas geograficas agregadas e exportacao CSV limitada, escapada e protegida contra formulas.
- Documentar e exercitar as oito rotas no Swagger e na colecao Bruno.
- Preservar webhooks e integracoes n8n exclusivamente para a Fase 9.

## Resumo da Fase 8

- Itens concluidos: 7
- Itens em desenvolvimento: 0
- Itens bloqueados: 0
- Itens nao iniciados: 0
- Progresso estimado: 100%

## Fase 9 - Webhooks e n8n

Estado: concluida e aprovada pelo usuario em 20 de julho de 2026.

### Checklist do PRD

- [x] Validar segredo, assinatura, rate limit, idempotencia e hash do payload.
  - Evidencia: HMAC-SHA256 usa timestamp e corpo bruto, comparacao constante, janela anti-replay e ID externo; o teste HTTP real aprovou evento novo, repeticao identica, conflito, assinatura invalida e HTTP 429.
- [x] Impedir duplicidade, auditar e remover segredos dos logs.
  - Evidencia: unicidade por provedor e ID com hash de 64 caracteres; payload divergente retorna 409; teste do logger confirmou redacao de assinatura, segredo e autorizacao.
- [x] Implementar webhooks Telegram, WhatsApp, status e n8n.
  - Evidencia: as quatro rotas assinadas responderam no PostgreSQL real; Telegram e WhatsApp retornaram 202, status retornou 202 e callback n8n retornou 202/200 idempotente.
- [x] Implementar `webhook_events`, `outbox_events`, estados, tentativas e falhas.
  - Evidencia: reserva concorrente, lease, tentativas, backoff e falha terminal foram validados; entrega real ao mock n8n recuperou de HTTP 503 e terminou `PROCESSED` na segunda tentativa.
- [x] Testar assinatura, duplicidade, payload, rate limit, processamento, falha, retry e logs.
  - Evidencia: 176 testes passaram em 35 arquivos; cobertura final foi 87,16% statements, 80,58% branches, 89,44% functions e 88,85% lines.
- [x] Conferir eventos e outbox no Adminer.
  - Evidencia: Adminer confirmou estrutura, constraints, indices e tres itens de outbox `PROCESSED` com 0, 1 e 2 tentativas; o validador confirmou 8 webhooks e nenhum hash, tentativa ou dado operacional inseguro.
- [x] Atualizar Swagger, colecao Bruno e README.
  - Evidencia: Swagger 1.0.0 foi conferido visualmente com 51 caminhos e as oito rotas da fase; nove requisicoes Bruno, README e `docs/FASE9_VALIDACAO.md` foram atualizados.
- [x] Aprovar `npm run validate` e obter aprovacao explicita do usuario.
  - Evidencia: validate, cobertura, banco, formatacao e auditoria de dependencias passaram; o usuario aprovou a Fase 9 e autorizou o planejamento e a implementacao da Fase 10 em 20 de julho de 2026.

### Plano tecnico

- Criar modulos `notifications` e `webhooks` com schemas Zod, tipos, repositorios PostgreSQL, servicos e rotas.
- Disponibilizar as quatro rotas autenticadas do PRD para notificacoes internas, sempre restritas ao usuario do token.
- Receber Telegram, WhatsApp, atualizacoes de status e eventos do n8n com corpo bruto preservado para assinatura HMAC-SHA256.
- Exigir identificador externo, timestamp recente e assinatura em comparacao constante, usando segredo exclusivo de ambiente e sem registra-lo em logs ou banco.
- Aplicar limite de requisicoes por provedor e origem, sem armazenar dados pessoais alem do necessario para a protecao operacional.
- Registrar cada recebimento em `webhook_events` com hash SHA-256 e unicidade por provedor e identificador externo; repeticoes identicas serao idempotentes e payload divergente sera conflito.
- Processar um contrato normalizado e auditado: relatos externos gerarao eventos de outbox; atualizacoes de status serao registradas sem contornar a maquina de estados; callbacks do n8n confirmarao eventos de saida existentes.
- Criar eventos de outbox na mesma transacao das operacoes suportadas e um processador com reserva, tentativas limitadas, reagendamento e estado final de falha.
- Documentar contratos, assinaturas, codigos HTTP, exemplos e limitacoes no Swagger, Bruno, README e relatorio da fase.
- Preservar revisao global de seguranca, deploy e demais entregas finais exclusivamente para a Fase 10.

## Resumo da Fase 9

- Itens concluidos: 8
- Itens em desenvolvimento: 0
- Itens bloqueados: 0
- Itens nao iniciados: 0
- Progresso estimado: 100%

## Fase 10 - Finalizacao e deploy

Estado: implementacao e validacao tecnica concluidas em 20 de julho de 2026; aguardando aprovacao explicita do usuario.

### Checklist do PRD

- [x] Executar todos os testes, cobertura e fluxos completos.
  - Evidencia: 207 testes passaram em 40 arquivos; cobertura final de 88,65% statements, 82,47% branches, 91,02% functions e 90,77% lines.
- [x] Revisar modulos abaixo da meta.
  - Evidencia: o modulo de ocorrencias recebeu cobertura adicional e terminou com 88,92% statements, 87,75% branches, 90,90% functions e 90,76% lines; todas as metas globais foram superadas.
- [x] Testar permissoes, isolamento, falhas externas, migrations e seeds em banco limpo.
  - Evidencia: testes automatizados e fluxos HTTP confirmaram autenticacao, perfis e municipio; uma base temporaria nova recebeu migrations e seed e foi removida com sucesso.
- [x] Revisar todas as rotas, schemas, exemplos, codigos, autenticacao, multipart e erros no Swagger.
  - Evidencia: OpenAPI 3.0.3 com 52 paths, 61 operacoes e operation IDs unicos foi validado por testes, incluindo geocodificacao reversa, upload binario e HTTP 429.
- [x] Revisar colecao, ambientes e remover tokens reais.
  - Evidencia: ambiente Bruno mantem tokens vazios e segredos ficticios; duas requisicoes e tres testes de health passaram no CLI 3.5.2.
- [x] Revisar README completo e solucao de problemas.
- [x] Revisar segredos, CORS, Helmet, rate limit, logs, upload, SQL, autorizacao, isolamento, exclusao logica e LGPD.
  - Evidencia: limite global, proxy configuravel e validacao de producao foram adicionados; a revisao esta consolidada em `docs/RELATORIO_SEGURANCA.md`.
- [x] Criar diagrama ER, contratos da IA, painel e n8n, e relatorio de seguranca.
- [x] Documentar limitacoes.
- [x] Executar lint, unit, integration, coverage, build e validate.
- [x] Subir Docker, migrations e seeds.
  - Evidencia: imagem multi-stage iniciou sem privilegios, com raiz somente leitura e healthcheck saudavel; migrations, seed e schema passaram.
- [x] Testar Swagger, Adminer, colecao e curl.
  - Evidencia: interfaces foram inspecionadas e o roteiro HTTP real confirmou respostas 200, 204, 401, 403 e 404 esperadas.
- [x] Confirmar ausencia de segredos, funcoes vazias e TODO como implementacao.
- [~] Obter aprovacao final do usuario.

### Plano tecnico

- Auditar o repositorio, a cobertura, os contratos HTTP, os arquivos de ambiente e a configuracao de execucao em producao.
- Reforcar testes apenas nos modulos abaixo das metas globais ou em riscos sem evidencia suficiente, preservando as metas de 80% para statements, functions e lines e 70% para branches.
- Validar migrations e seed em um banco temporario limpo, sem apagar ou substituir o banco local existente.
- Revisar o OpenAPI completo e a colecao Bruno contra as rotas realmente montadas, incluindo autenticacao, multipart, erros e ausencia de credenciais persistidas.
- Produzir ou atualizar README, ERD, contratos de IA, painel e n8n, relatorio de seguranca e limitacoes conhecidas.
- Preparar execucao de producao em container com healthcheck, usuario sem privilegios, configuracao externa e procedimento de deploy documentado.
- Executar a matriz final: lint, testes unitarios e de integracao, cobertura, build, validate, Docker, banco, Swagger, Adminer, Bruno e curl.
- Manter qualquer publicacao em provedor externo fora da execucao automatica ate existir destino e autorizacao especificos.

## Resumo da Fase 10

- Itens concluidos: 13
- Itens em desenvolvimento: 1
- Itens bloqueados: 0
- Itens nao iniciados: 0
- Progresso estimado: 98%

## FE‑0 — Fundação do aplicativo cidadão

Estado: concluída e aprovada pelo usuário em 20 de julho de 2026; publicada para revisão no PR #1.

### Checklist do PRD de continuação

- [x] Isolar a aplicação em `apps/citizen-web` e criar a branch `feature/citizen-foundation`.
- [x] Configurar React, TypeScript estrito, Vite, Router, TanStack Query, Zod e Tailwind.
- [x] Criar ambiente público validado, cliente HTTP central, timeout, cancelamento e erros seguros.
- [x] Integrar os contratos reais de `/health` e `/health/database` sem alterar o back-end.
- [x] Implementar layout responsivo e as rotas `/`, `/status`, `/indisponivel` e 404.
- [x] Implementar link de salto, landmarks, foco visível, teclado e movimento reduzido.
- [x] Preparar manifesto e identidade mínima para evolução PWA.
- [x] Criar testes Vitest, Testing Library, MSW e Playwright.
- [x] Aprovar lint, tipos, 29 testes, cobertura, build e 4 cenários E2E.
- [x] Validar visualmente desktop e mobile com os serviços locais reais.
- [x] Documentar execução, evidências, segurança e limitações.
- [x] Aplicar a direção visual moderna aprovada à página inicial, ao status e ao design system, mantendo as jornadas futuras explicitamente como planejadas.
- [x] Obter aprovação final do usuário.
  - Evidência: o usuário aprovou a FE‑0, autorizou sua publicação e autorizou o planejamento e a implementação da fase seguinte.

### Evidências

- 29 testes Vitest aprovados; cobertura de 86,16% statements, 71,33% branches, 88,88% functions e 90,64% lines.
- 4 cenários Playwright aprovados nos perfis desktop e mobile.
- API e banco exibidos como disponíveis no navegador, sem erro de console ou rolagem horizontal em 390 × 844.
- Direção visual consolidada em [DIRECAO_VISUAL_CIDADAO.md](DIRECAO_VISUAL_CIDADAO.md), com mapa-conceito não interativo e regras de privacidade/IA.
- Relatório completo em [FE0_VALIDACAO.md](FE0_VALIDACAO.md) e limitações em [FE0_LIMITACOES.md](FE0_LIMITACOES.md).

## FE‑1 — Autenticação e perfil cidadão

Estado: concluída e aprovada pelo usuário em 20 de julho de 2026; publicada para revisão no PR #2.

### Checklist do PRD de continuação

- [x] Implementar cadastro cidadão com validação local e município definido pela implantação.
- [x] Implementar login e mensagens seguras para credenciais inválidas, indisponibilidade e timeout.
- [x] Recuperar a sessão pelo refresh token em cookie `httpOnly` sem persistir tokens no navegador.
- [x] Manter o access token somente em memória e renovar uma única vez após HTTP 401.
- [x] Implementar rota protegida `/perfil` com redirecionamento para `/entrar`.
- [x] Consultar os dados da sessão e atualizar somente nome, telefone e bairro pelo contrato existente.
- [x] Implementar logout remoto com encerramento local garantido mesmo se a API estiver indisponível.
- [x] Preservar CORS, contratos e respostas da API sem alterar o back-end.
- [x] Tratar HTTP 409, 401 e 422 sem exibir mensagens internas ou dados sensíveis.
- [x] Validar teclado, labels, foco, contraste, desktop e largura móvel de 390 px.
- [x] Aprovar lint, tipos, 40 testes, cobertura, build e 6 cenários E2E.
- [x] Documentar configuração pública, segurança, contratos e roteiro manual.
- [x] Obter aprovação final do usuário.
  - Evidência: o usuário aprovou a FE‑1 e autorizou sua publicação e a fase seguinte; a entrega foi publicada no PR #2 a partir do commit `0eac13f`.

### Evidências

- 10 arquivos e 40 testes Vitest aprovados; cobertura de 89,86% statements, 76,51% branches, 92,39% functions e 92,21% lines.
- 6 cenários Playwright aprovados em Chromium desktop e mobile, incluindo cadastro, login, perfil e logout.
- Login, cadastro e perfil inspecionados no navegador com API local; sem erro de console ou rolagem horizontal.
- Refresh token mantido exclusivamente em cookie `httpOnly`; access token mantido em memória e removido no logout.
- Relatório completo em [FE1_VALIDACAO.md](FE1_VALIDACAO.md).

## FE‑2 — Mapa público

Estado: concluída e aprovada pelo usuário em 21 de julho de 2026; publicada para revisão no PR #3.

### Checklist do PRD de continuação

- [x] Implementar mapa público com dados reais de `GET /api/v1/occurrences/map`.
- [x] Implementar marcadores individuais e clusters por proximidade.
- [x] Manter lista pública acessível como alternativa ao mapa visual.
- [x] Implementar filtros por categoria, status e bairro usando os parâmetros suportados pela API.
- [x] Implementar busca textual local sobre a janela pública carregada, documentando o limite do contrato atual.
- [x] Solicitar localização do navegador somente sob ação explícita e sem enviá-la à API.
- [x] Oferecer fallback manual quando a localização é negada ou indisponível.
- [x] Implementar detalhes públicos com imagem, descrição, endereço aproximado, confirmações, status, prioridade e linha do tempo.
- [x] Tratar carregamento, vazio, erro do mapa base, falha da API e ocorrência inexistente.
- [x] Impedir exposição de autoria, coordenadas exatas e dados pessoais mesmo durante uma sessão autenticada.
- [x] Validar teclado, labels, desktop, mobile e ausência de rolagem horizontal.
- [x] Aprovar lint, tipos, 53 testes, cobertura, build e 8 cenários E2E.
- [x] Documentar contratos, limites, privacidade e roteiro manual.
- [x] Obter validação visual e aprovação final do usuário.
  - Evidência: após validar o mapa viário detalhado com ruas e bairros, o usuário confirmou que estava tudo certo e autorizou os próximos passos; a entrega foi publicada no PR #3 a partir do commit `5437295`.

### Evidências

- 14 arquivos e 53 testes Vitest aprovados; cobertura de 80,40% statements, 74,50% branches, 82,28% functions e 81,86% lines.
- 8 cenários Playwright aprovados em Chromium desktop e mobile, incluindo mapa, busca e detalhes.
- Respostas públicas validadas por Zod e chamadas do mapa/detalhes feitas sem credencial para preservar a sanitização pública.
- Localização do navegador mantida somente em memória, com cenário automatizado de permissão negada e retorno ao município.
- Branch `codex/citizen-public-map` publicada no PR [#3](https://github.com/jhonmatos01/ta-na-rua/pull/3), baseada na FE‑1 e sem alteração dos contratos do back-end.
- Relatório completo em [FE2_VALIDACAO.md](FE2_VALIDACAO.md).

## FE‑3 — Registro

Estado: implementação e validação técnica concluídas em 21 de julho de 2026; validação visual e publicação aprovadas pelo usuário em 22 de julho de 2026.

### Checklist do PRD de continuação

- [x] Criar rota autenticada e ação principal para registrar uma ocorrência.
- [x] Implementar imagem obrigatória com câmera/arquivo, prévia, tipo e tamanho validados.
- [x] Implementar título, descrição, categoria opcional, bairro, referência e publicação anônima.
- [x] Solicitar geolocalização somente sob ação explícita.
- [x] Oferecer fallback manual quando a localização é negada ou indisponível.
- [x] Permitir correção do ponto por marcador, clique no mapa e campos de coordenadas acessíveis.
- [x] Implementar revisão dos dados antes do envio.
- [x] Consultar possíveis duplicidades pelo endpoint oficial de proximidade.
- [x] Permitir confirmar um registro existente ou declarar explicitamente que é um problema diferente.
- [x] Enviar imagem e campos por `multipart/form-data` ao contrato existente.
- [x] Impedir clique duplo e requisições concorrentes de criação na interface.
- [x] Exibir mensagens claras para arquivo, permissão, localização, conflito, rede e sucesso.
- [x] Descartar posição em cache, exibir a margem de precisão do dispositivo e explicar a ausência temporária de registros em revisão no mapa público.
- [x] Preencher rua e bairro por endpoint autenticado de geocodificação reversa, com consentimento contextual, cache, limites e atribuição.
- [x] Validar teclado, labels, desktop, mobile e ausência de rolagem horizontal.
- [x] Aprovar lint, tipos, 66 testes, cobertura, build e 10 cenários E2E.
- [x] Documentar contratos, decisões, limites, privacidade e roteiro manual.
- [x] Obter validação visual e aprovação final do usuário.

### Evidências

- 18 arquivos e 66 testes Vitest aprovados; cobertura de 75,83% statements, 74,66% branches, 76,33% functions e 77,47% lines.
- 10 cenários Playwright aprovados em Chromium desktop e mobile; o novo fluxo executa upload, localização manual, revisão, envio único e protocolo.
- Envio multipart autenticado validado sem `Content-Type` manual; resposta de criação e confirmação validadas por Zod.
- Geolocalização solicitada somente por ação, mapa corrigível e alternativa manual sempre disponível.
- Após a validação visual, a leitura passou a usar `maximumAge: 0`, expor a margem informada pelo dispositivo e oferecer nova tentativa.
- Com aprovação explícita, a geocodificação reversa foi implementada por `POST` autenticado, provedor Nominatim compatível e configurável, cache, coalescência, limite por usuário, intervalo externo mínimo e atribuição visível; o Nominatim público fica restrito ao desenvolvimento.
- A confirmação de sucesso agora informa que ocorrências `PENDING_REVIEW` permanecem fora do mapa/lista públicos até publicação; acompanhamento próprio usará posteriormente o contrato autenticado `/api/v1/occurrences/mine`.
- Candidatos recebidos pelo contrato público sanitizado; confirmação existente protegida pela unicidade transacional do back-end.
- Relatório completo em [FE3_VALIDACAO.md](FE3_VALIDACAO.md).
- Validação visual, commit e publicação da FE‑3 aprovados explicitamente pelo usuário em 22 de julho de 2026.

## FE‑4 — Comunidade

Estado: concluída e aprovada pelo usuário em 22 de julho de 2026; publicada para revisão no PR #5.

### Checklist do PRD de continuação

- [x] Implementar **Eu também vi** somente para sessão cidadã.
- [x] Permitir remover a própria confirmação.
- [x] Consultar contador, prioridade e estado pessoal pelo contrato oficial.
- [x] Sincronizar os caches de confirmação, detalhes, lista e mapa após mutações.
- [x] Tratar confirmação duplicada, status não confirmável e remoção já efetivada.
- [x] Preservar e exibir a linha do tempo pública com estados independentes.
- [x] Implementar compartilhamento nativo, cópia e fallback manual somente com dados públicos.
- [x] Preservar privacidade, autorização e regras de negócio no back-end.
- [x] Validar teclado, labels, mensagens vivas, desktop, mobile e ausência de rolagem horizontal.
- [x] Retornar à ocorrência após o login, preservar a sessão no recarregamento e corrigir o cabeçalho móvel.
- [x] Aprovar 73 testes, cobertura e 14 cenários E2E.
- [x] Documentar contratos, limites, segurança e roteiro manual.
- [x] Obter validação visual e aprovação final do usuário.

### Evidências

- 19 arquivos e 73 testes Vitest aprovados; cobertura de 76,33% statements, 74,93% branches, 77,89% functions e 77,80% lines.
- 14 cenários Playwright aprovados em Chromium desktop e mobile, incluindo confirmação, remoção, recarga autenticada e cabeçalho móvel sem sobreposição.
- `GET confirmations/count` usa autenticação opcional; `POST` e `DELETE` permanecem autenticados e exclusivos de `CITIZEN`.
- HTTP 409 duplicado e HTTP 404 de remoção já efetivada provocam reconsulta, sem duplicar regras de status no navegador.
- Compartilhamento limitado ao título e à URL pública, com Web Share API, clipboard e fallback selecionável.
- Nenhuma alteração de back-end, banco, migration, formato de token ou contrato da API.
- Relatório completo em [FE4_VALIDACAO.md](FE4_VALIDACAO.md).
- Branch `codex/citizen-community` publicada no PR [#5](https://github.com/jhonmatos01/ta-na-rua/pull/5), a partir do commit `67a8d91`.

## FE‑5 — Conta e notificações

Estado: concluída e aprovada pelo usuário em 22 de julho de 2026; publicada para revisão no PR #6.

### Checklist do PRD de continuação

- [x] Implementar **Minhas ocorrências** com registros criados pela pessoa autenticada.
- [x] Implementar a relação de ocorrências confirmadas pela pessoa autenticada.
- [x] Implementar paginação, carregamento, erro e estados vazios independentes.
- [x] Implementar contador e lista de notificações com filtros de todas e não lidas.
- [x] Permitir marcar uma notificação ou todas as notificações como lidas.
- [x] Manter lista e contador sincronizados após cada ação.
- [x] Ampliar o perfil com situação da conta, município, datas, atalhos e avatar HTTPS opcional.
- [x] Preservar sessão por cookie `httpOnly`, autorização e privacidade das respostas públicas.
- [x] Documentar e testar o contrato aditivo `GET /api/v1/occurrences/confirmed-by-me`.
- [x] Validar teclado, labels, mensagens vivas, desktop, 320 px e ausência de rolagem horizontal.
- [x] Aprovar lint, tipos, testes, build e 18 cenários E2E.
- [x] Documentar contratos, decisão de compatibilidade, segurança e roteiro manual.
- [x] Obter validação visual e aprovação final do usuário.

### Evidências

- 207 testes do back-end e 79 testes Vitest do aplicativo aprovados; cobertura do aplicativo em 77,46% statements, 75,56% branches, 77,90% functions e 78,91% lines; 18 cenários Playwright aprovados em Chromium desktop e mobile.
- `GET /api/v1/occurrences/confirmed-by-me` é aditivo, autenticado, paginado e devolve somente a projeção pública sanitizada.
- Lista, contador e leitura de notificações usam os contratos existentes e invalidam os caches relacionados após a mutação.
- Avatar aceita somente URL HTTPS; dados privados permanecem restritos ao perfil autenticado e não entram nos cartões públicos.
- Navegação validada com a API e o banco locais em 320 × 760 e 1440 × 900, sem sobreposição ou rolagem horizontal.
- A barra móvel mantém marca compacta, registro, avisos e perfil; o encerramento de sessão também está disponível no perfil.
- Avaliações pendentes permanecem reservadas para a FE‑6, conforme o recorte do PRD.
- Relatório completo em [FE5_VALIDACAO.md](FE5_VALIDACAO.md).
- Branch `codex/citizen-notifications` publicada no PR [#6](https://github.com/jhonmatos01/ta-na-rua/pull/6), a partir do commit `7f6826b`.

## FE‑6 — Avaliação e PWA

Estado: concluída e aprovada pelo usuário em 22 de julho de 2026; pronta para publicação na branch `codex/citizen-evaluations`.

### Checklist do PRD de continuação

- [x] Implementar nota de 1 a 5, confirmação da resolução, qualidade opcional e comentário.
- [x] Permitir criação somente para cidadão relacionado e status autorizado pela API.
- [x] Permitir edição da própria avaliação dentro da janela definida pelo back-end.
- [x] Traduzir vínculo ausente, status inválido, duplicidade, prazo expirado e demais erros da API.
- [x] Exibir resumo público de avaliações sem dados pessoais.
- [x] Levar notificações de reparo diretamente ao formulário de avaliação.
- [x] Adicionar lista autenticada de reparos que ainda aguardam a avaliação do cidadão.
- [x] Manter respostas pessoais sanitizadas e contratos existentes inalterados.
- [x] Configurar manifesto, ícones regulares e maskable, instalação e modo standalone.
- [x] Registrar service worker somente no build de produção, sem armazenar chamadas da API.
- [x] Implementar fallback offline seguro e verificação automatizada dos artefatos PWA.
- [x] Aprovar validação completa, E2E e cobertura da fase.
- [x] Obter validação visual e aprovação final do usuário.
  - Evidência: o usuário confirmou "Tudo aprovado" após validar a avaliação pós-reparo, o resumo público e a experiência PWA.

### Decisões de compatibilidade

- O endpoint aditivo `GET /api/v1/occurrences/pending-evaluations` evita derivar pendências de notificações paginadas; ele exige `CITIZEN`, usa vínculo real e devolve a projeção pública sanitizada.
- O envio de imagem na avaliação permanece fora da interface porque o PRD o torna condicional e o contrato atual de avaliações não oferece upload; nenhum contrato existente foi alterado para simular suporte.
- A API continua sendo a única autoridade para vínculo, status avaliável, janela de edição e contestação automática.

Relatório em [FE6_VALIDACAO.md](FE6_VALIDACAO.md).

## FE‑7 — Estabilização e demonstração

Estado: concluída e aprovada pelo usuário em 24 de julho de 2026; publicada para revisão no PR #8.

### Checklist da versão candidata

- [x] Preservar todas as jornadas funcionais da FE‑0 à FE‑6.
- [x] Executar lint, TypeScript estrito, testes, cobertura e build do aplicativo.
- [x] Executar a validação integral do back-end preservado.
- [x] Auditar acessibilidade WCAG com Axe nas rotas públicas críticas em desktop e mobile; preservar as jornadas autenticadas nos E2E funcionais.
- [x] Corrigir contraste, semântica da marca e anúncio de restauração da sessão.
- [x] Auditar desempenho, acessibilidade, boas práticas e SEO com Lighthouse.
- [x] Revalidar E2E funcional, artefatos PWA e operação responsiva.
- [x] Verificar mapa com ruas, filtros e ocorrências em 320 × 760 e 1440 × 900.
- [x] Confirmar ausência de sobreposição móvel, rolagem horizontal e erros de console.
- [x] Documentar inicialização, demonstração, limites, segurança e métricas.
- [x] Obter validação visual final do usuário.
- [x] Publicar a branch e abrir o PR empilhado sobre a FE‑6.

### Evidências

- Relatório completo em [FE7_VALIDACAO.md](FE7_VALIDACAO.md).
- Roteiro reproduzível em [ROTEIRO_DEMONSTRACAO_CIDADAO.md](ROTEIRO_DEMONSTRACAO_CIDADAO.md).
- 207 testes do back-end e 83 testes unitários do aplicativo aprovados.
- 20 cenários funcionais e 14 auditorias Axe executados em desktop e mobile.
- Lighthouse aprovado na página inicial e no mapa, com limites explícitos por rota.
- Nenhuma alteração de banco, migration, contrato existente da API, JWT ou autorização.
- Branch `codex/citizen-stabilization` publicada no PR [#8](https://github.com/jhonmatos01/ta-na-rua/pull/8), a partir do commit `5d85b9a`.

## PM‑0 — Fundação do Painel da Prefeitura

Estado: implementação técnica e validação visual aprovadas pelo usuário em 24 de julho de 2026;
publicada para revisão no PR #9.

### Checklist

- [x] Criar aplicação separada em `apps/municipal-web`.
- [x] Implementar login e restauração de sessão pelo contrato oficial.
- [x] Manter o access token apenas em memória e o refresh em cookie `httpOnly`.
- [x] Restringir o painel a `CITY_OPERATOR`, `MODERATOR` e `ADMIN`.
- [x] Preservar o isolamento municipal imposto pelo back-end.
- [x] Consumir resumo, ranking e categorias reais do dashboard.
- [x] Implementar estados de carregamento, erro e vazio.
- [x] Criar layout responsivo para desktop e celular.
- [x] Adicionar imagens locais aos dois chamados determinísticos do seed.
- [x] Corrigir a incorporação cross-origin das imagens públicas e preservar as demais políticas de segurança.
- [x] Aprovar lint, tipos, build, seed, schema e integração HTTP local.
- [x] Obter validação visual do usuário.
- [x] Publicar a branch após aprovação explícita.

Relatório em [PM0_VALIDACAO.md](PM0_VALIDACAO.md).

Branch `codex/municipal-dashboard-foundation` publicada no PR
[#9](https://github.com/jhonmatos01/ta-na-rua/pull/9).

## PM‑1 — Fila operacional de ocorrências

Estado: implementação técnica e validação visual aprovadas pelo usuário em 24 de julho de
2026; publicada para revisão no PR #10.

### Checklist

- [x] Consumir a fila real de ocorrências no escopo municipal autorizado.
- [x] Implementar filtros por status, categoria, bairro e período.
- [x] Preservar filtros, paginação e chamado selecionado na URL.
- [x] Exibir imagens reais na fila e no detalhe, inclusive nos chamados de demonstração.
- [x] Implementar detalhe com dados operacionais, localização exata autorizada e histórico.
- [x] Não expor identidade do cidadão nem duplicar autorização no front-end.
- [x] Implementar carregamento, erro, vazio, atualização e paginação.
- [x] Manter Visão geral e Ocorrências acessíveis na navegação mobile.
- [x] Aprovar lint, tipos, build e validação integrada no navegador.
- [x] Obter validação visual do usuário.
- [x] Publicar a branch após aprovação explícita.

Relatório em [PM1_VALIDACAO.md](PM1_VALIDACAO.md).

Branch `codex/municipal-operations-queue` publicada no PR
[#10](https://github.com/jhonmatos01/ta-na-rua/pull/10), a partir do commit `5d0e042`.
