# PM‑2 — Revisão e operação dos chamados

## Estado

Implementação técnica e validação visual aprovadas pelo usuário em 24 de julho de 2026;
publicada para revisão no PR
[#11](https://github.com/jhonmatos01/ta-na-rua/pull/11), na branch
`codex/municipal-review-actions`.

## Incompatibilidade resolvida

O painel precisava saber quais transições eram permitidas para o perfil e o estado atuais, mas
a API expunha apenas a mutação. Reproduzir a máquina de estados no React criaria risco de
divergência e contrariaria o PRD.

Foi criado o contrato aditivo:

`GET /api/v1/occurrences/:occurrenceId/status-capabilities`

Ele retorna:

- estado operacional atual;
- transições permitidas para o perfil;
- campos obrigatórios de cada transição;
- permissão de atribuição;
- permissão de exclusão lógica.

Clientes existentes não precisam mudar. Não houve migration nem alteração destrutiva de
contrato.

## Entrega

- Ações de status calculadas exclusivamente pelo back-end.
- Campos condicionais para encaminhamento, agendamento, resolução, contestação, rejeição,
  duplicidade e reabertura.
- Mensagem pública opcional separada do motivo interno.
- Atribuição e reatribuição a departamentos ativos do mesmo município.
- Exclusão lógica somente para `MODERATOR` e `ADMIN`.
- Confirmação de exclusão pela frase `EXCLUIR`.
- Atualização da fila, detalhe, status e histórico após cada mutação.
- Estados de carregamento, sucesso, erro e bloqueio durante a requisição.

## Matriz validada

| Perfil          | Ocorrência em revisão          | Ocorrência publicada                       | Exclusão lógica |
| --------------- | ------------------------------ | ------------------------------------------ | --------------- |
| `CITY_OPERATOR` | sem ação de moderação          | encaminhar e atribuir no próprio município | não             |
| `MODERATOR`     | publicar, rejeitar ou duplicar | ações globais válidas                      | sim             |
| `ADMIN`         | publicar, rejeitar ou duplicar | ações globais válidas                      | sim             |

A API continua sendo a autoridade final e revalida perfil, município, transição, departamento,
datas, motivo e alvo de duplicidade.

## Validação executada

### Back-end

- `npm run lint`: aprovado.
- `npm test`: 210 testes aprovados em 40 arquivos.
- `npm run build`: aprovado.
- `npm run validate`: aprovado.
- 19 testes direcionados de status e HTTP aprovados.
- Inventário OpenAPI atualizado para 55 caminhos e 64 operações.

### Painel municipal

- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.
- `npm run validate`: aprovado.

### Navegador

- Operador não recebeu ações de moderação nem exclusão para chamado pendente.
- Operador recebeu somente encaminhamento e atribuição para chamado publicado.
- Moderadora recebeu publicar, rejeitar, duplicar e exclusão lógica.
- Selecionar rejeição exibiu o motivo interno obrigatório.
- A exclusão permaneceu desativada até a frase de confirmação.
- Nenhuma mutação destrutiva foi executada durante a validação visual.
- Desktop em 1440 × 900 e mobile sem rolagem horizontal.

## Roteiro manual

1. Abra `http://localhost:5174/?view=occurrences`.
2. Entre como operador e compare um chamado em revisão com um publicado.
3. Saia e entre como moderador.
4. Abra um chamado em revisão e alterne entre publicar, rejeitar e duplicar.
5. Confira os campos exigidos para cada ação.
6. Abra a confirmação de exclusão e verifique que o botão só habilita após `EXCLUIR`.
7. Cancele a exclusão se não quiser modificar os dados locais.
