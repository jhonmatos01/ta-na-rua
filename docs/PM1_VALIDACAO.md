# PM‑1 — Fila operacional de ocorrências

## Estado

Implementação técnica e validação visual aprovadas pelo usuário em 24 de julho de 2026 na
branch `codex/municipal-operations-queue`.

## Entrega

- Fila autenticada e paginada, limitada ao município autorizado pelo back-end.
- Filtros por status, categoria, bairro e intervalo de datas.
- Filtros e ocorrência selecionada preservados na URL.
- Miniaturas reais para ocorrências com imagem, incluindo os dois chamados de demonstração.
- Painel de detalhes com foto, descrição, prioridade, confirmações, risco, gravidade e data.
- Localização exata exibida somente na resposta operacional autenticada.
- Histórico de estados com mensagens públicas e motivo interno autorizado.
- Estados de carregamento, erro, vazio e tentativa novamente.
- Navegação responsiva entre visão geral e ocorrências.

## Segurança e limites

- Nenhum dado de identidade do cidadão é exibido.
- A API continua responsável pelo escopo municipal e pela autorização.
- O token de acesso permanece apenas em memória e a renovação continua em cookie `httpOnly`.
- Esta fase é somente de leitura. Alteração de status, encaminhamento e atribuição a equipes
  ficam reservados para a próxima fase.
- Nenhuma migration, tabela ou contrato existente da API foi alterado.

## Validação executada

- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.
- Teste integrado no navegador com a API e o banco locais:
  - cinco ocorrências retornadas;
  - cinco imagens carregadas com largura natural válida;
  - filtro `RESOLVED` reduziu a fila ao chamado esperado e foi preservado na URL;
  - detalhe do chamado de demonstração exibiu imagem, localização e histórico;
  - desktop em 1440 × 900 sem rolagem horizontal;
  - mobile com as duas rotas principais acessíveis e sem rolagem horizontal.

## Roteiro manual

1. Abra `http://localhost:5174/?view=occurrences`.
2. Entre com `operador@demo.local` e a senha de demonstração já usada no projeto, se solicitado.
3. Confira as miniaturas, especialmente os protocolos `TNR-2026-000001` e
   `TNR-2026-000002`.
4. Aplique um ou mais filtros.
5. Abra um chamado e verifique imagem, localização e histórico.
6. Reduza a janela para validar a navegação móvel entre **Visão geral** e **Ocorrências**.
