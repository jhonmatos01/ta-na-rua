# Validacao da Fase 8

Data da validacao tecnica: 20 de julho de 2026.

Estado: concluida e aprovada pelo usuario em 20 de julho de 2026.

## Escopo validado

- resumo municipal;
- agrupamento por categoria;
- agrupamento por bairro;
- agrupamento por status;
- ranking de prioridade;
- tempo de resolucao;
- mapa de calor do MVP;
- exportacao CSV do MVP;
- filtros de periodo, categoria, bairro, status e municipio;
- restricao por perfil e isolamento municipal;
- protecao de dados pessoais;
- consultas agregadas sem N+1;
- indices para periodo e resolucao;
- Swagger, colecao Bruno e README.

Webhooks, n8n, Telegram e WhatsApp continuam reservados para a Fase 9.

## Rotas

Todas as rotas exigem JWT e aceitam somente `CITY_OPERATOR`, `MODERATOR` ou `ADMIN`:

```text
GET /api/v1/dashboard/summary
GET /api/v1/dashboard/by-category
GET /api/v1/dashboard/by-neighborhood
GET /api/v1/dashboard/by-status
GET /api/v1/dashboard/priority-ranking
GET /api/v1/dashboard/resolution-time
GET /api/v1/dashboard/heatmap
GET /api/v1/dashboard/export
```

`CITIZEN` recebe HTTP 403. Usuario sem token recebe HTTP 401.

## Filtros

Os oito endpoints compartilham:

| Parametro        | Tipo     | Regra                                    |
| ---------------- | -------- | ---------------------------------------- |
| `municipalityId` | UUID     | opcional para MODERATOR e ADMIN          |
| `categoryId`     | UUID     | categoria da ocorrencia                  |
| `neighborhoodId` | UUID     | bairro da ocorrencia                     |
| `status`         | enum     | um dos 12 status definitivos             |
| `startDate`      | datetime | inicio inclusivo aplicado a `created_at` |
| `endDate`        | datetime | fim inclusivo aplicado a `created_at`    |

`endDate` anterior a `startDate`, UUID invalido, status desconhecido ou parametro extra geram HTTP 422.

O ranking tambem aceita `limit` entre 1 e 100, com padrao 25. A exportacao aceita somente `format=csv` e `limit` entre 1 e 10.000.

## Isolamento por perfil

| Perfil          | Escopo                                             |
| --------------- | -------------------------------------------------- |
| `CITIZEN`       | negado                                             |
| `CITY_OPERATOR` | sempre o municipio presente no token               |
| `MODERATOR`     | consolidado global ou `municipalityId` selecionado |
| `ADMIN`         | consolidado global ou `municipalityId` selecionado |

Se um operador envia outro `municipalityId`, a API responde `MUNICIPALITY_FORBIDDEN`. O repositorio nunca recebe o municipio solicitado nesse caso.

## Contratos dos indicadores

### Resumo

Retorna total, ativos, resolvidos, fechados, contestados, rejeitados, duplicados, confirmacoes, prioridade media e taxa de resolucao.

### Categoria, bairro e status

Cada grupo retorna identificador, codigo quando aplicavel, nome, contagem e percentual. Conjuntos vazios retornam arrays vazios, sem erro e sem divisao por zero.

### Ranking

Ordenacao:

1. maior `priority_score`;
2. maior `confirmation_count`;
3. relato mais antigo;
4. UUID como desempate deterministico.

O ranking nao inclui autor, e-mail, telefone, descricao, endereco ou coordenada.

### Tempo de resolucao

Utiliza `resolved_at - first_reported_at` e retorna quantidade, media, mediana, percentil 90, minimo e maximo em horas. Duracoes negativas sao rejeitadas pelo validador de dados.

### Mapa de calor

O PostGIS transforma os pontos para EPSG:3857 e os agrupa com `ST_SnapToGrid` em celulas de 250 metros. A resposta possui somente o centro aproximado da celula, contagem e prioridade media, com limite fixo de 1.000 celulas.

### Exportacao

O CSV usa UTF-8 com BOM, limite de 10.000 linhas e os cabecalhos:

```text
protocol,title,municipality_name,category_code,category_name,neighborhood_name,status,severity,risk_level,priority_score,confirmation_count,first_reported_at,resolved_at,created_at
```

Nao sao exportados usuario, e-mail, telefone, descricao, endereco nem latitude/longitude. Valores de texto iniciados por `=`, `+`, `-`, `@`, tabulacao ou retorno recebem apostrofo antes do escapamento RFC 4180, impedindo formula de planilha.

Os cabecalhos `X-Export-Row-Count`, `X-Export-Limit` e `X-Export-Truncated` informam o recorte aplicado.

## Banco e desempenho

A migration `drizzle/0002_optimal_network.sql` adiciona:

- `occurrences_municipality_created_idx (municipality_id, created_at)`;
- `occurrences_resolution_idx (municipality_id, resolved_at)`.

Eles complementam os indices `occurrences_dashboard_idx`, `occurrences_priority_idx`, `occurrences_neighborhood_idx` e `occurrences_location_gist_idx` existentes desde a Fase 1.

Cada indicador executa uma consulta agregada ou limitada diretamente no PostgreSQL. Nao existe consulta adicional por ocorrencia, categoria ou bairro.

O seed passou a usar datas deterministicas. A ocorrencia resolvida possui 30 horas entre primeiro relato e resolucao, permitindo validar o indicador sem duracao negativa.

`npm run db:validate` confirmou:

- 18 tabelas e 11 enums;
- 10 indices obrigatorios;
- 2 ocorrencias elegiveis para o dashboard;
- zero duracoes negativas;
- zero bairros de outro municipio;
- zero localizacoes invalidas para o mapa de calor.

## Validacao HTTP e PostgreSQL reais

Foi executada a aplicacao completa com Supertest, autenticacao real e repositorio PostgreSQL real. Os dados de login criados para a validacao foram removidos ao final.

Resultados:

- oito endpoints: HTTP 200;
- cidadao: HTTP 403;
- operador solicitando outro municipio: HTTP 403;
- administrador filtrando municipio sem ocorrencias: HTTP 200 e total zero;
- filtros combinados de categoria, bairro, status e periodo: uma ocorrencia;
- periodo vazio: zero ocorrencias;
- categoria, bairro, status e mapa: soma igual a duas ocorrencias;
- ranking: `TNR-2026-000001` antes de `TNR-2026-000002`;
- resolucao: uma ocorrencia, media/mediana/P90/minimo/maximo de 30 horas;
- exportacao: duas linhas, sem coluna pessoal ou coordenada exata;
- conjunto das oito requisicoes: 148,13 ms no banco local de demonstracao.

Uma consulta SQL direta foi comparada com `/dashboard/summary` e confirmou:

| Indicador                | API   | SQL direto |
| ------------------------ | ----- | ---------- |
| total de ocorrencias     | 2     | 2          |
| ocorrencias ativas       | 1     | 1          |
| ocorrencias resolvidas   | 1     | 1          |
| confirmacoes             | 1     | 1          |
| prioridade media         | 21,45 | 21,45      |
| tempo medio de resolucao | 30 h  | 30 h       |

## Testes automatizados

Foram adicionados nove testes especificos em:

- `tests/unit/dashboard.service.test.ts`;
- `tests/integration/phase8.routes.test.ts`.

Eles cobrem perfil, municipio, filtros, periodo invalido, limites, dados vazios, todos os indicadores, exportacao, truncamento, BOM, privacidade e protecao contra formulas.

Resultado da cobertura completa:

- 27 arquivos aprovados;
- 150 testes aprovados;
- statements: 87,04%;
- branches: 80,65%;
- functions: 89,71%;
- lines: 88,37%;
- modulo dashboard: 92,85% de statements, 88,33% de branches e 93,68% de lines.

## Swagger e Adminer

O Swagger 0.9.0 foi conferido visualmente. A tag `Dashboard` exibe as oito rotas protegidas e os schemas `DashboardFilters`, `DashboardSummary`, `DashboardGroup`, `DashboardPriorityItem`, `DashboardResolutionTime` e `DashboardHeatmapCell`.

No Adminer, a consulta de comparacao retornou a mesma linha do resumo e confirmou os dois indices da migration. O resultado foi uma linha em 0,020 segundo, sem dados pessoais.

## Colecao Bruno

A pasta `api-client/dashboard` contem nove requisicoes:

- oito cenarios validos, um por endpoint;
- um cenario invalido que confirma HTTP 403 para `CITIZEN`.

O ambiente local adiciona `categoryId`, `neighborhoodId`, `dashboardStartDate` e `dashboardEndDate`. Nenhum token real foi versionado.

## Checklist final

- [x] Resumo, categoria, bairro, status, prioridade, resolucao, mapa e exportacao implementados.
- [x] Filtros de periodo, categoria, bairro, status, municipio e perfil aplicados.
- [x] Dados pessoais protegidos, consultas sem N+1 e indices criados.
- [x] Dados vazios, filtros, agregacoes, municipios, perfis, desempenho e exportacao testados.
- [x] Resultados comparados visualmente com o Adminer.
- [x] Swagger, Bruno e README atualizados.
- [x] Validacao tecnica concluida e aprovada pelo usuario em 20 de julho de 2026 com a mensagem "aprovado".
