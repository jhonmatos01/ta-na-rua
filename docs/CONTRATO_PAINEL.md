# Contrato de integracao com o painel municipal

Versao do contrato: 1.0. Base local: `http://localhost:3333/api/v1`.

## Autenticacao e autorizacao

O painel obtem `accessToken` em `POST /auth/login` e envia `Authorization: Bearer <JWT>`. O refresh permanece em cookie `httpOnly` no caminho `/api/v1/auth`.

O dashboard aceita `CITY_OPERATOR`, `MODERATOR` e `ADMIN`:

- `CITY_OPERATOR`: sempre limitado ao municipio do token;
- `MODERATOR` e `ADMIN`: podem selecionar `municipalityId`;
- `CITIZEN`: recebe HTTP 403;
- usuario bloqueado, excluido ou com sessao revogada nao acessa o painel.

## Envelope JSON

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "de305d54-75b4-431b-adb2-eb6b9e546014" }
}
```

Erros usam `success: false`, `error.code`, `error.message`, `error.details` e o mesmo `meta.requestId`.

## Filtros compartilhados

| Filtro           | Tipo     | Regra                                         |
| ---------------- | -------- | --------------------------------------------- |
| `municipalityId` | UUID     | opcional apenas para perfis globais           |
| `categoryId`     | UUID     | categoria                                     |
| `neighborhoodId` | UUID     | bairro do municipio                           |
| `status`         | enum     | status definitivo da ocorrencia               |
| `startDate`      | ISO 8601 | inicio inclusivo sobre `createdAt`            |
| `endDate`        | ISO 8601 | fim inclusivo; nao pode anteceder `startDate` |

## Endpoints do dashboard

| Metodo | Caminho                       | `data` principal                                     |
| ------ | ----------------------------- | ---------------------------------------------------- |
| GET    | `/dashboard/summary`          | totais, confirmacoes, prioridade e taxa de resolucao |
| GET    | `/dashboard/by-category`      | grupos com chave, nome, contagem e percentual        |
| GET    | `/dashboard/by-neighborhood`  | grupos por bairro                                    |
| GET    | `/dashboard/by-status`        | grupos por status                                    |
| GET    | `/dashboard/priority-ranking` | ranking; `limit` de 1 a 100, padrao 25               |
| GET    | `/dashboard/resolution-time`  | media, mediana, p90, minimo e maximo em horas        |
| GET    | `/dashboard/heatmap`          | celulas agregadas com centro e contagem              |
| GET    | `/dashboard/export`           | CSV; `limit` de 1 a 10.000                           |

O CSV informa `X-Export-Row-Count`, `X-Export-Limit` e `X-Export-Truncated`. Campos iniciados por formula sao neutralizados. Ranking, mapa e exportacao nao incluem identidade, contato, descricao completa, endereco ou coordenadas exatas da ocorrencia.

## Operacao municipal

O painel tambem usa as rotas documentadas no Swagger para departamentos, atribuicao, transicao de status, historico e consulta de ocorrencias. Toda decisao operacional continua sujeita a perfil, municipio, estado atual e campos obrigatorios da transicao.

## Codigos relevantes

- 200: consulta ou alteracao concluida;
- 201: recurso criado;
- 401: token ausente, invalido, expirado ou sessao revogada;
- 403: perfil ou municipio sem permissao;
- 404: recurso nao encontrado ou nao visivel;
- 409: conflito de estado ou regra de negocio;
- 422: filtro, UUID, periodo ou corpo invalido;
- 429: limite global da API excedido;
- 503: dependencia temporariamente indisponivel.

O contrato executavel e a fonte definitiva de schemas e exemplos ficam em `/docs` e `/docs/openapi.json`.
