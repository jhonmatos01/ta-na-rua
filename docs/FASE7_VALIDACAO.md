# Validacao da Fase 7

Data da validacao tecnica: 19 de julho de 2026.

Estado: implementacao tecnicamente concluida; aguardando aprovacao explicita do usuario.

## Escopo validado

- contrato HTTP de classificacao conforme o PRD;
- URL e segredo configuraveis sem valor real versionado;
- timeout padrao de 8 segundos e no maximo duas tentativas totais;
- chave idempotente baseada no `reportId`;
- envio de report, imagem, descricao, localizacao, ocorrencias proximas e categorias ativas;
- resposta validada estruturalmente por Zod e semanticamente contra o contexto enviado;
- categoria, subcategoria, gravidade, risco, confianca, resumo, revisao e duplicidades;
- persistencia da resposta recebida redigida e da resposta validada;
- fallback para configuracao ausente, timeout, indisponibilidade, HTTP invalido e resposta invalida;
- baixa confianca e duplicidade acima do limiar direcionadas para revisao humana;
- aplicacao controlada de categoria, gravidade, risco e prioridade;
- proibicao de alterar status ou decidir fusao automaticamente;
- tres rotas internas protegidas por segredo.

A tabela `ai_analyses`, `suggested_subcategory` e as constraints de confianca e gravidade ja existiam desde a migration da Fase 1. Por isso, a Fase 7 nao exigiu nova migration.

## Contrato enviado ao servico

O back-end envia `POST {AI_SERVICE_URL}/analyze` com JSON:

```json
{
  "analysisType": "CLASSIFICATION",
  "reportId": "uuid",
  "imageUrl": "https://storage.example/image.webp",
  "description": "Buraco grande na via",
  "latitude": -12.9941,
  "longitude": -38.459,
  "nearbyOccurrences": [
    {
      "id": "uuid",
      "category": "POTHOLE",
      "distanceMeters": 12,
      "description": "Outro buraco",
      "imageUrls": []
    }
  ],
  "availableCategories": [{ "code": "POTHOLE", "name": "Buraco na via" }]
}
```

Cabecalhos privados:

- `x-ai-service-secret`: `AI_SERVICE_SECRET`;
- `x-idempotency-key`: `reportId`.

O payload nao inclui nome, e-mail, telefone, token, cookie, endereco residencial ou identificador do cidadao.

## Resposta esperada

```json
{
  "category": "POTHOLE",
  "subcategory": "ASPHALT_DAMAGE",
  "severity": 4,
  "risk": "HIGH",
  "confidence": 0.91,
  "summary": "Buraco de grande dimensao.",
  "requiresHumanReview": false,
  "possibleDuplicates": [
    {
      "occurrenceId": "uuid",
      "similarity": 0.87,
      "reason": "Localizacao e imagem semelhantes."
    }
  ]
}
```

Zod exige estrutura estrita, gravidade entre 1 e 5, risco conhecido, confianca e similaridade entre 0 e 1, UUIDs validos e limites de texto. Depois disso, o servico confirma que a categoria estava entre as opcoes enviadas e que cada duplicidade pertence aos candidatos proximos apresentados ao modelo.

## Regras de aplicacao

| Condicao                                                | Resultado                                       |
| ------------------------------------------------------- | ----------------------------------------------- |
| Confianca maior ou igual a 0,75 e sem revisao explicita | Aplica categoria, gravidade, risco e prioridade |
| Confianca abaixo de 0,75                                | Nao aplica classificacao e exige revisao        |
| Similaridade maior ou igual a 0,80                      | Registra `REQUIRES_REVIEW`, sem fusao           |
| Categoria ou duplicidade fora do contexto               | `DOMAIN_INCONSISTENCY` e revisao                |
| Timeout, indisponibilidade ou resposta invalida         | Fallback persistido e ocorrencia preservada     |

Mesmo quando a classificacao e aplicada, o status nao e alterado. A IA nunca escreve diretamente no banco; somente o repositorio do back-end persiste a decisao controlada. `duplicate_of_occurrence_id` nunca e preenchido por este modulo.

## Variaveis de ambiente

| Variavel                      | Padrao                | Regra                                 |
| ----------------------------- | --------------------- | ------------------------------------- |
| `AI_SERVICE_URL`              | desabilitada em dev   | Obrigatoria com segredo e em producao |
| `AI_SERVICE_SECRET`           | desabilitada em dev   | Nunca versionar valor real            |
| `AI_MODEL_NAME`               | `external-ai-service` | Identificacao registrada na analise   |
| `AI_TIMEOUT_MS`               | `8000`                | Entre 100 e 60000 ms                  |
| `AI_MAX_ATTEMPTS`             | `2`                   | Entre 1 e 3 tentativas totais         |
| `AI_MIN_CONFIDENCE`           | `0.75`                | Entre 0 e 1                           |
| `AI_DUPLICATE_MIN_SIMILARITY` | `0.80`                | Entre 0 e 1                           |

URL e segredo devem existir em conjunto. Em producao, ambos sao obrigatorios. Em desenvolvimento, ambos vazios desabilitam a chamada externa e geram o fallback `NOT_CONFIGURED` depois que a ocorrencia ja foi criada.

## Rotas internas

| Metodo | Caminho                                    | Finalidade                         |
| ------ | ------------------------------------------ | ---------------------------------- |
| `POST` | `/api/v1/internal/ai/classify`             | Reexecuta classificacao            |
| `POST` | `/api/v1/internal/ai/find-duplicates`      | Reexecuta sugestao de duplicidades |
| `POST` | `/api/v1/internal/ai/recalculate-priority` | Reconcilia a prioridade oficial    |

Todas exigem `x-ai-service-secret`. Segredo ausente ou incorreto retorna HTTP 401. Quando a integracao nao esta configurada, a protecao retorna HTTP 503. O cabeçalho e removido dos logs pelo Pino.

## Estados persistidos

- `VALIDATED`;
- `NOT_CONFIGURED`;
- `TIMEOUT`;
- `UNAVAILABLE`;
- `HTTP_ERROR`;
- `INVALID_RESPONSE`;
- `DOMAIN_INCONSISTENCY`.

`raw_result` registra estado, tentativas e resposta recebida redigida. Em sucesso tambem registra a resposta validada. Chaves como `authorization`, `cookie`, `secret`, `token`, `password` e `apiKey` sao removidas recursivamente antes da persistencia.

## Validacao automatizada

Foram executados:

```bash
npm run format
npm run validate
npm run test:coverage
npm run db:seed
npm run db:validate
npm run format:check
npm audit --omit=dev
```

Resultado registrado:

- 25 arquivos e 141 testes aprovados;
- 22 testes novos ou ampliados para a Fase 7;
- statements: 86,57%;
- branches: 80,04%;
- functions: 89,00%;
- lines: 87,95%;
- modulo `ai`: 92,25% de statements, 93,40% de branches e 93,18% de linhas;
- lint, build TypeScript e Prettier aprovados;
- zero vulnerabilidades em dependencias de producao.

O repositorio PostgreSQL da IA fica fora da metrica unitaria e foi exercitado pelo fluxo real abaixo.

## Evidencia com PostgreSQL e servico HTTP real local

Um servidor HTTP local temporario simulou o provedor externo. Foram criadas duas ocorrencias e seis analises temporarias; todos os dados, auditorias, notificacoes e arquivos temporarios foram removidos ao final.

| Evidencia                                | Resultado                                 |
| ---------------------------------------- | ----------------------------------------- |
| Contrato completo recebido pelo servidor | confirmado                                |
| Segredo correto somente no cabecalho     | confirmado                                |
| Chave idempotente igual ao report        | confirmado                                |
| Classificacao valida                     | `VALIDATED`, confianca 0,91               |
| Duplicidade com similaridade 0,87        | revisao humana, sem fusao                 |
| Timeout                                  | 2 tentativas e fallback `TIMEOUT`         |
| Resposta invalida                        | 1 tentativa e fallback `INVALID_RESPONSE` |
| Confianca baixa 0,40                     | validada, nao aplicada e em revisao       |
| HTTP 503 temporario                      | sucesso na segunda tentativa              |
| Servico desligado                        | 2 tentativas e fallback `UNAVAILABLE`     |
| Status das duas ocorrencias              | `PENDING_REVIEW`                          |
| `duplicate_of_occurrence_id`             | nulo                                      |
| Historico adicional por decisao da IA    | zero                                      |
| Chaves sensiveis em `raw_result`         | zero                                      |
| Segredo nos logs HTTP                    | `[REDACTED]`                              |

A ocorrencia classificada recebeu `POTHOLE`, gravidade 4 e risco `HIGH`; a ocorrencia com timeout permaneceu sem categoria, gravidade ou risco. Isso comprova aplicacao controlada e fallback sem perda do registro.

## Seed e Adminer

O seed idempotente cria uma analise segura para `TNR-2026-000001`:

- tipo `CLASSIFICATION`;
- modelo `phase-7-seed-model`;
- categoria `POTHOLE`;
- gravidade 3;
- risco `MEDIUM`;
- confianca 0,910;
- estado bruto `VALIDATED`;
- zero duplicidades;
- `duplicate_of_occurrence_id` nulo.

Esses dados foram conferidos visualmente no Adminer. O validador tambem confirmou zero campos invalidos, categorias desconhecidas, estados ausentes, baixas confiancas sem revisao ou segredos no resultado bruto.

## Swagger e Bruno

O Swagger 0.8.0 exibe a tag `Internal AI`, as tres rotas protegidas e os schemas `AiProcessingResult`, `AiProcessingResponse` e `AiPriorityResponse`. A descricao informa que as rotas nao sao publicas e que falhas externas preservam a ocorrencia.

A pasta `api-client/internal-ai` contem as tres requisicoes Bruno. Defina `aiServiceSecret` com o mesmo valor ficticio usado no ambiente local; nenhum segredo real e versionado.

## Limite da validacao externa

O PRD define um contrato generico e nenhum provedor de IA ou credencial de producao foi fornecido. Por isso, timeout, retry, validacao e persistencia foram comprovados contra um servidor HTTP local controlado, nao contra um fornecedor externo. A troca do provedor exige somente configurar URL, segredo e garantir que ele implemente o contrato documentado.

## Checklist para aprovacao

- [x] Cliente HTTP com URL, segredo, timeout e tentativas.
- [x] Protecao do segredo e falhas externas.
- [x] Contrato completo sem dados pessoais.
- [x] Validacao estrutural e de dominio.
- [x] Resposta bruta redigida e validada persistida.
- [x] Fallback com ocorrencia preservada.
- [x] Sem banco direto, mudanca de status ou fusao automatica.
- [x] Casos validos, invalidos, timeout, indisponibilidade, baixa confianca, duplicidade e retry.
- [x] Adminer, Swagger, Bruno, README e banco.
- [x] Aprovacao explicita do usuario em 19 de julho de 2026: "Aprovo a Fase 7 e autorizo o planejamento e implementacao da Fase 8".

## Observacao de escopo

Dashboard, agregacoes, indicadores, mapa de calor e exportacao permanecem exclusivamente na Fase 8 e nao foram iniciados sem autorizacao do usuario.
