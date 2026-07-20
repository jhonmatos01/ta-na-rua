# Validacao da Fase 6

Data da validacao tecnica: 19 de julho de 2026.

Estado: concluida e aprovada pelo usuario em 19 de julho de 2026.

## Escopo validado

- avaliacao de reparo por cidadao relacionado a ocorrencia;
- nota obrigatoria de 1 a 5, problema resolvido, qualidade opcional de 1 a 5 e comentario opcional;
- uma avaliacao por ocorrencia e usuario;
- criacao somente em `RESOLVED` ou `CLOSED`;
- edicao da propria avaliacao durante o prazo configurado de sete dias;
- listagem detalhada com controle de relacao, perfil e municipio;
- resumo publico agregado sem comentarios ou identificadores pessoais;
- contestacao automatica com pelo menos tres avaliacoes e 50% ou mais negativas;
- historico, auditoria, notificacoes e limpeza das datas de conclusao na mesma transacao;
- reabertura operacional de `CONTESTED` para `IN_PROGRESS` pela maquina da Fase 5.

O schema definitivo, a restricao de unicidade e os checks de nota ja existiam desde a migration da Fase 1. Por isso, a Fase 6 nao exigiu nova migration.

## Contrato HTTP

| Metodo  | Caminho                                       | Finalidade                      |
| ------- | --------------------------------------------- | ------------------------------- |
| `POST`  | `/api/v1/occurrences/:id/evaluations`         | Cria a avaliacao do cidadao     |
| `GET`   | `/api/v1/occurrences/:id/evaluations`         | Lista avaliacoes autorizadas    |
| `GET`   | `/api/v1/occurrences/:id/evaluations/summary` | Retorna resumo publico agregado |
| `PATCH` | `/api/v1/occurrences/:id/evaluations/me`      | Edita a avaliacao do cidadao    |

## Regras e configuracao

| Regra                             | Padrao | Variavel de ambiente                    |
| --------------------------------- | ------ | --------------------------------------- |
| Prazo para edicao                 | 7 dias | `EVALUATION_EDIT_WINDOW_DAYS`           |
| Proporcao negativa para contestar | 50%    | `EVALUATION_NEGATIVE_THRESHOLD=0.5`     |
| Quantidade minima para contestar  | 3      | `EVALUATION_MIN_COUNT_FOR_CONTESTATION` |

Uma avaliacao e negativa quando `problemResolved` e `false`. O limite de edicao e inclusivo. Depois de uma reabertura operacional para `IN_PROGRESS`, a avaliacao deixa de ser editavel mesmo que o prazo ainda nao tenha terminado.

## Permissoes e privacidade

- `CITIZEN`: cria ou edita apenas a propria avaliacao quando for criador, autor de relato ou confirmador da ocorrencia.
- `CITY_OPERATOR`: consulta detalhes somente para ocorrencias do proprio municipio.
- `MODERATOR` e `ADMIN`: consultam detalhes globalmente.
- consulta detalhada: nunca devolve `userId`.
- resumo: publico somente quando a ocorrencia tem visibilidade publica e nunca inclui comentarios ou dados pessoais.
- nenhum perfil pode criar avaliacao em nome de outro usuario.

## Contestacao atomica

O repositorio bloqueia a ocorrencia com `FOR UPDATE`. Quando o minimo e a proporcao negativa sao atingidos, a mesma transacao:

1. persiste a avaliacao ou edicao;
2. altera o status para `CONTESTED`;
3. limpa `resolved_at`, `resolved_by`, `closed_at` e `closed_by`;
4. recalcula a prioridade;
5. cria historico de status;
6. cria auditorias da avaliacao e da contestacao;
7. cria notificacoes para os usuarios relacionados e os perfis operacionais autorizados.

O bloqueio tambem impede duas requisicoes concorrentes de criarem duas contestacoes ou historicos duplicados.

## Erros de dominio

| Condicao                           | HTTP | Codigo                               |
| ---------------------------------- | ---- | ------------------------------------ |
| Status nao permite avaliacao       | 409  | `OCCURRENCE_NOT_EVALUABLE`           |
| Cidadao nao relacionado            | 403  | `OCCURRENCE_RELATION_REQUIRED`       |
| Avaliacao duplicada                | 409  | `EVALUATION_ALREADY_EXISTS`          |
| Avaliacao propria inexistente      | 404  | `EVALUATION_NOT_FOUND`               |
| Prazo de edicao expirado           | 409  | `EVALUATION_EDIT_WINDOW_EXPIRED`     |
| Status atual nao permite edicao    | 409  | `EVALUATION_NOT_EDITABLE_FOR_STATUS` |
| Nota, qualidade ou corpo invalidos | 422  | `VALIDATION_ERROR`                   |

## Validacao automatizada

Foram executados:

```bash
npm run format
npm run validate
npm run test:coverage
npm run db:validate
npm run format:check
npm audit --omit=dev
```

Resultado registrado:

- 22 arquivos e 119 testes aprovados, sendo 19 testes novos da Fase 6;
- statements: 85,73%;
- branches: 78,09%;
- functions: 89,28%;
- lines: 87,20%;
- modulo `evaluations`: 94,23% de statements e 94,89% de linhas;
- lint, build TypeScript e Prettier aprovados;
- zero vulnerabilidades em dependencias de producao.

Os repositorios PostgreSQL reais ficam fora da metrica unitaria e foram exercitados pelo fluxo real descrito abaixo.

## Evidencia no PostgreSQL real

Foram criados temporariamente quatro cidadaos, dois operadores e duas ocorrencias. Todos os dados temporarios e seus relacionamentos foram removidos ao final.

| Evidencia                                    | Resultado      |
| -------------------------------------------- | -------------- |
| Avaliacao valida                             | HTTP 201       |
| Avaliacao duplicada                          | HTTP 409       |
| Cidadao nao relacionado                      | HTTP 403       |
| Ocorrencia em status invalido                | HTTP 409       |
| Nota fora de 1 a 5                           | HTTP 422       |
| Edicao depois do prazo                       | HTTP 409       |
| Duas avaliacoes concorrentes                 | HTTP 201/201   |
| Resposta que disparou a contestacao          | exatamente uma |
| Status depois de 2 negativas em 3 avaliacoes | `CONTESTED`    |
| Proporcao negativa publica                   | 66,67%         |
| Datas de resolucao e fechamento              | nulas          |
| Historico automatico de contestacao          | 1              |
| Auditorias de avaliacao                      | 4              |
| Auditoria de contestacao                     | 1              |
| Notificacoes relacionadas                    | 11             |
| Identificador pessoal na lista detalhada     | ausente        |
| Operador de outro municipio                  | HTTP 403       |
| Reabertura `CONTESTED -> IN_PROGRESS`        | HTTP 200       |
| Edicao depois da reabertura                  | HTTP 409       |

A limpeza retornou o banco ao seed: 7 usuarios, 2 ocorrencias, 1 avaliacao e 2 notificacoes. O validador confirmou zero notas invalidas, zero usuarios nao relacionados, zero duplicidades e zero contestacoes automaticas pendentes.

## Teste pelo Swagger

1. Acesse http://127.0.0.1:3333/docs/.
2. Confirme a versao 0.7.0 e a tag `Evaluations`.
3. Abra `GET /api/v1/occurrences/{occurrenceId}/evaluations/summary`.
4. Clique em **Try it out** e informe `60000000-0000-4000-8000-000000000002`.
5. Execute e confirme HTTP 200.

Na validacao visual, a resposta retornou `RESOLVED`, total 1, zero negativas, nota media 5, qualidade media 4, minimo 3, limiar 50% e `eligibleForContestation: false`.

## Conferencia no Adminer

Acesse http://127.0.0.1:8080 e execute:

```sql
SELECT
  o.protocol,
  o.status,
  COUNT(e.id) AS evaluation_count,
  COUNT(e.id) FILTER (WHERE e.problem_resolved = false) AS negative_count,
  ROUND(AVG(e.rating)::numeric, 2) AS average_rating,
  ROUND(AVG(e.service_quality)::numeric, 2) AS average_service_quality
FROM occurrences o
LEFT JOIN repair_evaluations e ON e.occurrence_id = o.id
GROUP BY o.id, o.protocol, o.status
ORDER BY o.protocol;
```

A conferencia visual retornou `TNR-2026-000001` em `PUBLISHED` sem avaliacao e `TNR-2026-000002` em `RESOLVED` com uma avaliacao, zero negativas, nota media 5,00 e qualidade media 4,00.

## Colecao Bruno

A pasta `api-client/evaluations` contem requisicoes para criar, listar, resumir e editar a propria avaliacao. O ambiente `local` define `evaluationOccurrenceId` com a ocorrencia resolvida do seed. Como esse seed ja possui a avaliacao da Ana, a requisicao de criacao aceita HTTP 409 como evidencia esperada de unicidade; as demais requisicoes usam o registro existente.

## Checklist para aprovacao

- [x] Criacao, notas, relacao, status e unicidade.
- [x] Edicao no prazo e resumo agregado.
- [x] Proporcao negativa e quantidade minima.
- [x] Contestacao automatica transacional.
- [x] Historico, auditoria e notificacoes.
- [x] Casos obrigatorios, concorrencia e reabertura.
- [x] Adminer, Swagger, Bruno e README.
- [x] Testes, cobertura, build e banco.
- [x] Aprovacao explicita do usuario.
  - Evidencia: o usuario escreveu "aprovo a Fase 6 e autorizo o planejamento e implementacao da Fase 7".

## Observacao de escopo

A Fase 6 conclui o ultimo bloco funcional obrigatorio do MVP descrito no PRD. Classificacao, gravidade e sugestao semantica de duplicidade por IA permanecem exclusivamente na Fase 7 e nao foram iniciadas sem autorizacao do usuario.
