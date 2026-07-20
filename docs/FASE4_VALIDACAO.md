# Validacao da Fase 4

Data da validacao tecnica: 19 de julho de 2026.

Estado: implementacao tecnicamente concluida; aguardando aprovacao explicita do usuario.

## Escopo validado

- confirmacao cidada `Eu tambem vi`, com comentario opcional de ate 500 caracteres;
- prevencao de duplicidade por usuario e ocorrencia;
- remocao exclusiva da propria confirmacao;
- consulta publica da contagem e da prioridade;
- `confirmedByMe` somente para usuario autenticado;
- contador exato e prioridade atualizados na mesma transacao;
- formula de prioridade centralizada no `PriorityService`;
- notificacao do autor e auditoria;
- reconciliacao administrativa a partir da tabela oficial;
- privacidade de ocorrencias ainda nao publicas.

## Contrato HTTP

| Metodo   | Caminho                                       | Acesso                                 |
| -------- | --------------------------------------------- | -------------------------------------- |
| `POST`   | `/api/v1/occurrences/:id/confirmations`       | `CITIZEN` autenticado                  |
| `DELETE` | `/api/v1/occurrences/:id/confirmations/me`    | `CITIZEN` autenticado                  |
| `GET`    | `/api/v1/occurrences/:id/confirmations/count` | Publico; contexto autenticado opcional |

## Formula de prioridade

O `PriorityService` e a unica implementacao da formula:

```text
confirmationScore = min(confirmationCount / 20, 1) * 100
severityScore     = severity / 5 * 100, ou 0
ageScore          = min(daysOpen / 30, 1) * 100
riskScore         = LOW 25, MEDIUM 50, HIGH 75, CRITICAL 100, ou 0

priority = confirmationScore * 0.35
         + severityScore * 0.25
         + ageScore * 0.20
         + riskScore * 0.20
```

O resultado e limitado entre 0 e 100 e arredondado para duas casas decimais.

## Validacao automatizada

Foram executados:

```bash
npm run format
npm run validate
npm run test:coverage
npm run db:recalculate-priorities
npm run db:validate
npm run format:check
npm audit --omit=dev
```

Resultado registrado:

- 15 arquivos e 74 testes aprovados;
- statements: 85,28%;
- branches: 77,92%;
- functions: 89,38%;
- lines: 86,04%;
- lint e build TypeScript aprovados;
- zero vulnerabilidades em dependencias de producao.

Os repositorios PostgreSQL reais nao entram na metrica unitaria. O servico, as rotas e o `PriorityService` atingiram, em conjunto, cobertura superior aos limites configurados e o repositorio foi exercitado no banco local pelos cenarios abaixo.

## Evidencia de concorrencia e transacao real

Duas requisicoes `POST` simultaneas, com o mesmo cidadao e a mesma ocorrencia, retornaram:

| Requisicao  | Resultado                              |
| ----------- | -------------------------------------- |
| Primeira    | HTTP 201 `CREATED`                     |
| Concorrente | HTTP 409 `CONFIRMATION_ALREADY_EXISTS` |

Depois da inclusao, o PostgreSQL confirmou contador armazenado 2, contagem oficial 2, prioridade 29,07, uma notificacao recente e uma auditoria recente. A remocao retornou HTTP 204 e restaurou contador 1 e prioridade 27,32.

Os dados temporarios, a notificacao e as auditorias geradas exclusivamente por essa validacao foram removidos. A confirmacao original do seed foi preservada.

## Reconciliacao administrativa

Execute:

```bash
npm run db:recalculate-priorities
```

Na validacao, a rotina bloqueou e processou as 2 ocorrencias ativas, recalculou os contadores pela tabela `occurrence_confirmations` e nao encontrou divergencia. O comando pode ser repetido com seguranca.

## Teste pelo Swagger

1. Acesse http://localhost:3333/docs.
2. Abra `GET /api/v1/occurrences/{id}/confirmations/count`.
3. Clique em **Try it out** e informe `60000000-0000-4000-8000-000000000001`.
4. Execute e confirme HTTP 200.

Na validacao visual, o Swagger 0.5.0 exibiu as tres operacoes da tag `Confirmations` e retornou contador 1 e prioridade 27,32. A resposta publica nao incluiu `confirmedByMe`.

Para testar inclusao e remocao, faca login como cidadao, use **Authorize** com o `accessToken` e execute `POST` seguido de `DELETE`.

## Conferencia no Adminer

Acesse http://127.0.0.1:8080, conecte ao PostgreSQL usando as variaveis locais e execute:

```sql
SELECT
  o.protocol,
  o.confirmation_count,
  (SELECT COUNT(*)::integer
     FROM occurrence_confirmations c
    WHERE c.occurrence_id = o.id) AS source_count,
  o.priority_score
FROM occurrences o
WHERE o.id = '60000000-0000-4000-8000-000000000001';
```

A conferencia visual retornou `TNR-2026-000001`, contador armazenado 1, fonte oficial 1 e prioridade 27,32.

## Casos obrigatorios cobertos

| Cenario                        | Resultado                              |
| ------------------------------ | -------------------------------------- |
| Primeira confirmacao           | HTTP 201 e contador incrementado       |
| Tentativa duplicada            | HTTP 409 `CONFIRMATION_ALREADY_EXISTS` |
| Remocao da propria confirmacao | HTTP 204 e contador decrementado       |
| Consulta de contagem           | HTTP 200 com contador e prioridade     |
| Recalculo de prioridade        | Novo score nas duas mutacoes           |
| Perfil nao cidadao             | HTTP 403 `FORBIDDEN`                   |
| Ocorrencia nao confirmavel     | HTTP 409 `OCCURRENCE_NOT_CONFIRMABLE`  |
| Pendencia invisivel ao publico | HTTP 404 `OCCURRENCE_NOT_FOUND`        |

## Checklist para aprovacao

- [x] Rotas e regras de confirmacao implementadas.
- [x] Duplicidade e concorrencia protegidas.
- [x] Contador e prioridade transacionais.
- [x] Reconciliacao administrativa criada.
- [x] Notificacao, auditoria e privacidade validadas.
- [x] Swagger, Bruno, README e roteiro atualizados.
- [x] Testes, cobertura, build, banco e auditoria aprovados.
- [ ] Aprovacao explicita do usuario.

## Observacao de escopo

A Fase 4 nao altera o fluxo operacional de status nem encaminha ocorrencias a departamentos; isso pertence a Fase 5. Classificacao por IA e deteccao semantica de duplicidade permanecem na Fase 7. A prioridade atual usa somente os sinais ja disponiveis, tratando gravidade ou risco ausentes como zero.
