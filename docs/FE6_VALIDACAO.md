# FE‑6 — Relatório de validação

Data: 22 de julho de 2026

Branch: `codex/citizen-evaluations`

Estado: validação técnica e visual concluída; entrega aprovada pelo usuário.

## Resultado entregue

- formulário autenticado para criar ou editar a avaliação pós-reparo;
- nota geral de 1 a 5, confirmação da resolução, qualidade opcional e comentário de até 1.000 caracteres;
- resumo público agregado, sem identificação de avaliadores;
- abertura direta do formulário por notificação `REPAIR_EVALUATION_REQUESTED`;
- aba **Avaliar reparos** em `Minhas ocorrências`;
- endpoint aditivo `GET /api/v1/occurrences/pending-evaluations`;
- manifesto PWA, quatro ícones PNG, modo standalone, instalação, service worker e fallback offline;
- build de produção e verificador automatizado dos artefatos PWA.

## Segurança e compatibilidade

- A API continua sendo a autoridade para perfil `CITIZEN`, vínculo com a ocorrência, status avaliável, unicidade, janela de edição e contestação automática.
- A listagem de pendências considera criação, relato ou confirmação e exclui quem já avaliou; a resposta reutiliza a projeção pública sanitizada.
- O service worker não intercepta nem armazena requisições da API e ignora origens externas.
- Access token continua somente em memória; refresh token continua em cookie `httpOnly`.
- Nenhuma migration, tabela, contrato existente, JWT ou regra de autorização foi alterado.
- Imagem de avaliação não foi implementada: o PRD a define como condicional e o contrato atual não oferece upload.

## Validação automatizada

### Back-end

- ESLint: aprovado.
- Testes: 207/207 aprovados em 40 arquivos.
- Build TypeScript: aprovado.
- OpenAPI: 54 paths e 63 operações documentadas.
- Cobertura: 88,67% statements, 82,49% branches, 91,11% functions e 90,76% lines.

### Aplicativo cidadão

- ESLint: aprovado.
- TypeScript estrito: aprovado.
- Vitest/RTL/MSW: 83/83 aprovados em 23 arquivos.
- Build Vite de produção: aprovado.
- PWA check: manifesto, service worker, fallback offline e ícones 192/512 regulares e `maskable` aprovados.
- Cobertura: 77,47% statements, 74,08% branches, 77,66% functions e 78,92% lines.
- Playwright: os 19 cenários da execução integral final passaram; o cenário novo de avaliação foi reexecutado e aprovado em Chromium desktop e Pixel 7, cobrindo os 20 cenários da fase.

## Validação visual

- Aplicativo real com API e PostgreSQL/PostGIS locais.
- Larguras inspecionadas: 350 px e 1440×900.
- Sem rolagem horizontal, sobreposição do cabeçalho ou erro de console.
- Detalhe resolvido exibe chamada para avaliação e quatro indicadores agregados.
- Perfil exibe o cartão de instalação com instrução alternativa quando o evento nativo não está disponível.
- Estado de autorização negada foi verificado com mensagem segura para cidadão sem vínculo.

## Infraestrutura local

- PostgreSQL/PostGIS: ativo e saudável na porta local 5433.
- Adminer: ativo na porta 8080.
- Aplicativo: `http://localhost:5173`.
- API: `http://localhost:3333`.

## Roteiro manual para aprovação

1. Abra `http://localhost:5173/ocorrencias/60000000-0000-4000-8000-000000000002`.
2. Confira o bloco **A comunidade avalia o resultado** e seus indicadores.
3. Abra `Minhas ocorrências` e selecione **Avaliar reparos**; o estado vazio confirma que a conta atual está em dia.
4. Abra o perfil e localize **Leve o Tá na Rua! para a tela inicial**.
5. Em uma conta relacionada a uma ocorrência resolvida, abra **Avaliar reparo**, preencha os campos e confirme a mensagem de sucesso.

## Aprovação e observação de produção

- aprovação visual final registrada pelo usuário em 22 de julho de 2026;
- instalação em HTTPS deverá ser revalidada no ambiente de produção, pois navegadores exigem contexto seguro fora de `localhost`.
