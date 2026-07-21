# FE‑0 — relatório de validação

Data: 20 de julho de 2026.

Estado: implementação e validação técnica concluídas na branch `feature/citizen-foundation`; aguardando revisão e aprovação do usuário.

## Escopo validado

- aplicação isolada em `apps/citizen-web`, sem conversão do repositório em monorepo;
- React 19, TypeScript estrito, Vite 8, React Router, TanStack Query, Zod e Tailwind CSS 4;
- rotas `/`, `/status`, `/indisponivel` e 404;
- cliente HTTP central com timeout, `AbortSignal`, request ID, erros padronizados e mensagens públicas seguras;
- contratos reais de `GET /health` e `GET /health/database` validados com Zod;
- layout responsivo, link de salto, landmarks semânticos, navegação por teclado, foco visível e preferência por movimento reduzido;
- preparação PWA com manifesto, ícone e metadados, sem service worker nesta fase;
- testes unitários, de integração com MSW e E2E com Playwright.

## Resultados automatizados

| Verificação             | Resultado                                      |
| ----------------------- | ---------------------------------------------- |
| `npm run lint`          | aprovado                                       |
| `npm run typecheck`     | aprovado                                       |
| `npm test`              | 29 testes aprovados em 7 arquivos              |
| `npm run test:coverage` | aprovado; metas globais superadas              |
| `npm run build`         | aprovado; 166 módulos transformados            |
| `npm run test:e2e`      | 4 cenários aprovados em desktop e perfil móvel |

Cobertura final:

| Métrica    | Resultado | Meta |
| ---------- | --------: | ---: |
| Statements |    86,16% |  75% |
| Branches   |    71,33% |  65% |
| Functions  |    88,88% |  70% |
| Lines      |    90,64% |  75% |

## Validação visual e integrada

- interface inicial renderizada e inspecionada em navegador real;
- `/status` confirmou API e banco como `Disponível` contra os serviços locais reais;
- atualização manual completou sem erros ou alertas no console;
- desktop validado em viewport padrão;
- mobile validado em `390 × 844`, com documento de `375 px` dentro da viewport e sem rolagem horizontal;
- a inspeção visual encontrou e corrigiu uma largura mínima do mapa-conceito que recortava o texto do hero em telas estreitas;
- página 404 e navegação da home para status verificadas nos dois perfis Playwright;
- Docker Compose confirmou PostgreSQL/PostGIS saudável durante a validação.

## Segurança e privacidade

- o front-end não contém credenciais, tokens, senhas, chaves privadas ou segredos JWT;
- `.env` local permanece ignorado pelo Git e contém somente configuração pública de desenvolvimento;
- detalhes internos de erros não chegam à interface;
- a versão do PostGIS é validada no contrato, mas não é exposta visualmente;
- nenhuma nova rota, payload ou contrato do back-end foi alterado.

## Roteiro manual

1. Inicie Docker e API na raiz com `npm run docker:up` e `npm run dev`.
2. Em `apps/citizen-web`, copie `.env.example` para `.env` e execute `npm run dev`.
3. Abra `http://localhost:5173`.
4. Confirme `Disponível` no resumo da API.
5. Abra `Status` e confirme API pública e banco de dados.
6. Clique em `Atualizar status` e confirme que os dois cartões continuam disponíveis.
7. Abra `http://localhost:5173/rota-inexistente` e confirme a página 404.
8. Redimensione para uma largura próxima de 390 px e confirme que não há rolagem horizontal.
