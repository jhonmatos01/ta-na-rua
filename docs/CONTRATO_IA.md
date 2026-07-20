# Contrato de integracao com IA

Versao do contrato: 1.0. Data de referencia: 20 de julho de 2026.

## Direcao API para IA

A API envia `POST {AI_SERVICE_URL}/analyze` com `Content-Type: application/json`.

Cabecalhos obrigatorios:

| Cabecalho             | Conteudo                               |
| --------------------- | -------------------------------------- |
| `x-ai-service-secret` | segredo exclusivo, fora do repositorio |
| `x-idempotency-key`   | UUID do report que originou a analise  |
| `accept`              | `application/json`                     |
| `content-type`        | `application/json`                     |

Corpo:

```json
{
  "analysisType": "CLASSIFICATION",
  "reportId": "61000000-0000-4000-8000-000000000001",
  "imageUrl": "https://cdn.example.com/occurrences/2026/image.webp",
  "description": "Pavimento danificado na via",
  "latitude": -12.9714,
  "longitude": -38.5014,
  "nearbyOccurrences": [
    {
      "id": "60000000-0000-4000-8000-000000000002",
      "category": "Buraco em via",
      "distanceMeters": 18.2,
      "description": "Dano semelhante",
      "imageUrls": []
    }
  ],
  "availableCategories": [{ "code": "ROAD_POTHOLE", "name": "Buraco em via" }]
}
```

`analysisType` aceita `CLASSIFICATION`, `DUPLICATE_DETECTION`, `CONTENT_MODERATION` ou `REASSESSMENT`. O payload nao inclui nome, e-mail, telefone, senha, token ou endereco do cidadao.

## Resposta da IA

Resposta HTTP 2xx obrigatoria:

```json
{
  "category": "ROAD_POTHOLE",
  "subcategory": "ASPHALT",
  "severity": 4,
  "risk": "HIGH",
  "confidence": 0.91,
  "summary": "Dano relevante no pavimento.",
  "requiresHumanReview": false,
  "possibleDuplicates": [
    {
      "occurrenceId": "60000000-0000-4000-8000-000000000002",
      "similarity": 0.87,
      "reason": "Local e dano semelhantes."
    }
  ]
}
```

Regras de validacao:

- estrutura estrita, sem campos desconhecidos;
- gravidade inteira entre 1 e 5;
- risco `LOW`, `MEDIUM`, `HIGH` ou `CRITICAL`;
- confianca e similaridade entre 0 e 1;
- no maximo 10 sugestoes de duplicidade;
- categoria e IDs devem existir no contexto enviado;
- a IA nunca altera status nem funde ocorrencias automaticamente.

## Timeout, retry e fallback

- timeout padrao: 8 segundos por tentativa;
- tentativas totais padrao: 2;
- retry apenas para timeout, indisponibilidade, HTTP 408, 429 ou 5xx;
- resposta acima de 256 KiB ou fora do schema vira `INVALID_RESPONSE`;
- estados de falha: `NOT_CONFIGURED`, `TIMEOUT`, `UNAVAILABLE`, `HTTP_ERROR` e `INVALID_RESPONSE`;
- toda falha preserva a ocorrencia e exige revisao humana.

## Rotas internas da API

As rotas abaixo exigem `x-ai-service-secret` e nao usam JWT:

- `POST /api/v1/internal/ai/classify`;
- `POST /api/v1/internal/ai/find-duplicates`;
- `POST /api/v1/internal/ai/recalculate-priority`.

Corpo: `{ "occurrenceId": "uuid" }`. O segredo nunca aparece no corpo, resposta, banco ou log.

## Compatibilidade

Campos novos na resposta externa devem ser opcionais ate que o schema da API seja versionado. Remover ou renomear campos, mudar enums ou semantica de confianca exige nova versao do contrato e testes coordenados.
