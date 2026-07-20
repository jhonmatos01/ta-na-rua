# Validacao da Fase 5

Data da validacao tecnica: 19 de julho de 2026.

Estado: implementacao tecnicamente concluida; aguardando aprovacao explicita do usuario.

## Escopo validado

- CRUD, ativacao e inativacao logica de departamentos;
- isolamento municipal para operador;
- maquina definitiva com 24 transicoes;
- permissoes de `CITIZEN`, `CITY_OPERATOR`, `MODERATOR` e `ADMIN`;
- atribuicao e reatribuicao a departamento ativo do mesmo municipio;
- previsao, agendamento, inicio, resolucao, fechamento, contestacao e reabertura;
- decisao administrativa de duplicidade e desfazer duplicidade;
- historico publico e detalhado;
- auditoria e notificacoes atomicas;
- recálculo da prioridade ao reabrir.

## Contrato HTTP

| Metodo   | Caminho                                  | Finalidade                      |
| -------- | ---------------------------------------- | ------------------------------- |
| `PATCH`  | `/api/v1/occurrences/:id/status`         | Executa transicao valida        |
| `PATCH`  | `/api/v1/occurrences/:id/assignment`     | Atribui departamento e previsao |
| `GET`    | `/api/v1/occurrences/:id/status-history` | Historico publico/detalhado     |
| `GET`    | `/api/v1/departments`                    | Lista departamentos             |
| `POST`   | `/api/v1/departments`                    | Cria departamento               |
| `GET`    | `/api/v1/departments/:id`                | Consulta departamento           |
| `PATCH`  | `/api/v1/departments/:id`                | Atualiza departamento           |
| `PATCH`  | `/api/v1/departments/:id/active`         | Ativa ou desativa               |
| `DELETE` | `/api/v1/departments/:id`                | Inativa sem exclusao fisica     |

## Maquina de estados

| Status atual     | Proximos status validos                |
| ---------------- | -------------------------------------- |
| `PENDING_REVIEW` | `PUBLISHED`, `REJECTED`, `DUPLICATE`   |
| `PUBLISHED`      | `FORWARDED`, `REJECTED`, `DUPLICATE`   |
| `FORWARDED`      | `ACKNOWLEDGED`, `UNDER_ANALYSIS`       |
| `ACKNOWLEDGED`   | `UNDER_ANALYSIS`                       |
| `UNDER_ANALYSIS` | `SCHEDULED`, `IN_PROGRESS`, `REJECTED` |
| `SCHEDULED`      | `IN_PROGRESS`, `UNDER_ANALYSIS`        |
| `IN_PROGRESS`    | `RESOLVED`, `UNDER_ANALYSIS`           |
| `RESOLVED`       | `CLOSED`, `CONTESTED`, `IN_PROGRESS`   |
| `CLOSED`         | `CONTESTED`                            |
| `CONTESTED`      | `IN_PROGRESS`, `RESOLVED`              |
| `REJECTED`       | `PENDING_REVIEW`                       |
| `DUPLICATE`      | `PENDING_REVIEW`                       |

Qualquer combinacao ausente retorna HTTP 409 `INVALID_STATUS_TRANSITION`, inclusive para `ADMIN`.

## Campos obrigatorios por transicao

| Destino     | Campos obrigatorios                                  |
| ----------- | ---------------------------------------------------- |
| `FORWARDED` | `departmentId` ativo e `expectedResolutionAt` futura |
| `SCHEDULED` | `scheduledFor` futura                                |
| `RESOLVED`  | `resolutionDescription`                              |
| `DUPLICATE` | `duplicateOfOccurrenceId` valido e `reason`          |
| `REJECTED`  | `reason`                                             |
| `CONTESTED` | `reason`                                             |
| Reabertura  | `reason`; datas de resolucao/fechamento sao limpas   |

## Permissoes

- `CITIZEN`: nao altera status diretamente; consulta o historico publico.
- `CITY_OPERATOR`: executa transicoes de atendimento somente no proprio municipio; nao publica, rejeita ou decide duplicidade.
- `MODERATOR`: executa todas as transicoes validas, inclusive moderacao, com alcance global.
- `ADMIN`: executa todas as transicoes validas, com alcance global.

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

- 19 arquivos e 100 testes aprovados;
- statements: 84,88%;
- branches: 77,03%;
- functions: 89,38%;
- lines: 86,43%;
- lint, build TypeScript e Prettier aprovados;
- zero vulnerabilidades em dependencias de producao.

Os repositorios PostgreSQL reais ficam fora da metrica unitaria e foram exercitados pelo fluxo real descrito abaixo.

## Evidencia no PostgreSQL real

O protocolo `TNR-2026-000001` foi usado temporariamente e restaurado no final. O fluxo executou:

```text
PUBLISHED -> FORWARDED -> ACKNOWLEDGED -> UNDER_ANALYSIS
-> SCHEDULED -> IN_PROGRESS -> RESOLVED -> CLOSED
-> CONTESTED -> IN_PROGRESS
```

Resultados antes da limpeza:

| Evidencia                       | Resultado     |
| ------------------------------- | ------------- |
| Transicao inexistente           | HTTP 409      |
| Operador de outro municipio     | HTTP 403      |
| Duas transicoes concorrentes    | HTTP 200/409  |
| Status final do fluxo           | `IN_PROGRESS` |
| Historicos criados              | 9             |
| Auditorias da ocorrencia        | 10            |
| Notificacoes relacionadas       | 20            |
| Prioridade apos reabertura      | 27,35         |
| Datas de conclusao apos reabrir | nulas         |
| Motivo no historico publico     | ausente       |

A transicao invalida e a tentativa de outro municipio nao criaram historico, auditoria ou notificacao. Isso confirma rollback antes do commit.

O departamento temporario percorreu criacao, consulta, edicao, desativacao, reativacao e inativacao via `DELETE`. Todos os registros temporarios, auditorias, notificacoes, historicos e sessoes foram removidos; o seed permaneceu com 3 departamentos.

## Teste pelo Swagger

1. Acesse http://127.0.0.1:3333/docs/.
2. Confirme a versao 0.6.0 e as tags `Status` e `Departments`.
3. Abra `GET /api/v1/occurrences/{occurrenceId}/status-history`.
4. Clique em **Try it out** e informe `60000000-0000-4000-8000-000000000001`.
5. Execute e confirme HTTP 200 com `PENDING_REVIEW -> PUBLISHED`.

Na validacao visual, a resposta publica retornou `success: true`, mensagem publica e nenhum motivo interno.

## Conferencia no Adminer

Acesse http://127.0.0.1:8080 e execute:

```sql
SELECT
  o.protocol,
  o.status,
  o.assigned_department_id,
  o.resolved_at,
  o.closed_at,
  (SELECT COUNT(*) FROM occurrence_status_history h
    WHERE h.occurrence_id = o.id) AS history_count,
  (SELECT COUNT(*) FROM departments d WHERE d.active) AS active_departments,
  (SELECT COUNT(*) FROM occurrences x
     JOIN departments d ON d.id = x.assigned_department_id
    WHERE x.deleted_at IS NULL
      AND d.municipality_id <> x.municipality_id) AS invalid_assignments
FROM occurrences o
WHERE o.id = '60000000-0000-4000-8000-000000000001';
```

A conferencia visual apos a limpeza retornou `TNR-2026-000001`, `PUBLISHED`, atribuicao nula, datas nulas, um historico do seed, tres departamentos ativos e zero atribuicoes entre municipios.

## Checklist para aprovacao

- [x] Departamentos e isolamento municipal.
- [x] Maquina com as 24 transicoes.
- [x] Validacao de perfil, municipio e campos.
- [x] Atendimento municipal e datas definitivas.
- [x] Historico, auditoria e notificacoes atomicas.
- [x] Concorrencia e rollback real.
- [x] Swagger, Bruno, README e Adminer.
- [x] Testes, cobertura, build e banco.
- [ ] Aprovacao explicita do usuario.

## Observacao de escopo

A Fase 5 permite contestacao administrativa e reabertura manual. A criacao e atualizacao de avaliacoes, a proporcao negativa e a contestacao automatica pertencem a Fase 6. A sugestao semantica de duplicidade pela IA permanece na Fase 7; a decisao final manual por moderador ou administrador ja respeita a maquina de estados desta fase.
