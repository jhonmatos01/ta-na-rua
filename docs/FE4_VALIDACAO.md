# FE‑4 — Relatório de validação

Data: 22 de julho de 2026.

## Resultado

A FE‑4 implementa a etapa **Comunidade** do PRD de continuação na branch `codex/citizen-community`. A entrega está tecnicamente concluída e aguarda validação visual e aprovação explícita antes de commit ou publicação.

## Escopo entregue

- card comunitário nos detalhes públicos;
- contador e prioridade consultados pelo contrato oficial com autenticação opcional;
- botão **Eu também vi** para sessão `CITIZEN`;
- remoção da própria confirmação;
- reconciliação segura de confirmação duplicada e remoção já efetivada;
- invalidação dos caches de detalhes, mapa, lista e estado pessoal;
- convite de login para visitantes e bloqueio explicativo para outros perfis;
- retorno automático à ocorrência que originou o login;
- recuperação de sessão em chamada única, inclusive sob `StrictMode`, sem invalidar o refresh rotativo;
- compartilhamento pela Web Share API, cópia para a área de transferência ou link manual;
- linha do tempo pública preservada com carregamento, vazio e indisponibilidade independentes;
- feedback por texto, `aria-pressed`, região nomeada e mensagens vivas que não dependem somente de cor.

## Contratos utilizados

| Ação                        | Contrato                                          |
| --------------------------- | ------------------------------------------------- |
| Estado atual                | `GET /api/v1/occurrences/:id/confirmations/count` |
| Confirmar                   | `POST /api/v1/occurrences/:id/confirmations`      |
| Remover confirmação própria | `DELETE /api/v1/occurrences/:id/confirmations/me` |
| Histórico público           | `GET /api/v1/occurrences/:id/timeline`            |

Nenhum contrato do back-end, schema de banco, migration ou regra de autorização foi alterado. O front-end não replica a lista de status confirmáveis: a API permanece como fonte oficial e HTTP 409 é traduzido em estado compreensível.

## Segurança e privacidade

- visitante consulta somente contagem pública e não envia `Authorization`;
- sessão autenticada permanece em memória e usa o cliente HTTP centralizado;
- somente o perfil `CITIZEN` recebe a ação de mutação;
- o link compartilhado contém somente a rota pública e o título já publicado;
- nome, usuário, token, coordenadas exatas e dados internos não entram no compartilhamento;
- requisições concorrentes ficam bloqueadas durante a mutação;
- mensagens técnicas da API não são exibidas diretamente.

## Evidências automatizadas

| Gate                       | Resultado                                                          |
| -------------------------- | ------------------------------------------------------------------ |
| Vitest/Testing Library/MSW | 19 arquivos e 73 testes aprovados                                  |
| Cobertura                  | 76,33% statements; 74,93% branches; 77,89% functions; 77,80% lines |
| Playwright                 | 14 cenários aprovados em Chromium desktop e mobile                 |
| TypeScript                 | modo estrito aprovado                                              |
| ESLint e Prettier          | aprovados                                                          |
| Build Vite                 | aprovado                                                           |

Os testes cobrem consulta pública e autenticada, cabeçalho JWT, confirmação, remoção HTTP 204, sincronização do contador, HTTP 409 duplicado, sessão anônima, retorno pós-login, recuperação única da sessão, fallback de compartilhamento e cabeçalho móvel sem sobreposição ou rolagem horizontal.

## Roteiro visual e manual

1. inicie Docker, API e frontend conforme o README;
2. abra `http://localhost:5173/mapa` e uma ocorrência publicada;
3. sem login, confirme o contador, a linha do tempo, o convite **Entre para confirmar** e o compartilhamento;
4. entre com uma conta `CITIZEN` e volte aos detalhes;
5. pressione **Eu também vi** e confirme contador, prioridade, mensagem e estado pressionado;
6. atualize a página e confirme que o estado pessoal permanece sincronizado pela API;
7. use **Desfazer minha confirmação** e confirme a redução do contador;
8. teste **Compartilhar ocorrência** em celular e desktop;
9. navegue por teclado e repita em largura móvel sem rolagem horizontal.

## Fora do escopo

**Minhas ocorrências**, histórico de atividades confirmadas, notificações e perfil ampliado pertencem à FE‑5. Avaliação e instalação PWA pertencem à FE‑6.
