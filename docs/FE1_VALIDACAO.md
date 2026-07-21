# FE‑1 — Relatório de validação

Data: 20 de julho de 2026.

## Resultado

A FE‑1 implementa a jornada de autenticação e perfil do aplicativo cidadão sem alterar contratos do back-end. A entrega está tecnicamente concluída na branch local `codex/citizen-auth-profile` e aguarda aprovação antes de commit ou publicação.

## Escopo entregue

- cadastro em `/criar-conta` com nome, e-mail, telefone opcional, bairro opcional, senha e confirmação;
- login em `/entrar` com retorno seguro para credenciais inválidas;
- recuperação de sessão ao iniciar o aplicativo;
- rota protegida `/perfil` com redirecionamento para o login;
- leitura dos dados devolvidos pela sessão e edição de nome, telefone e bairro;
- logout remoto e limpeza local garantida;
- navegação e chamadas públicas adaptadas ao estado anônimo ou autenticado;
- layout moderno, responsivo e coerente com a direção visual aprovada.

## Contratos utilizados

| Operação              | Contrato existente           |
| --------------------- | ---------------------------- |
| Cadastro              | `POST /api/v1/auth/register` |
| Login                 | `POST /api/v1/auth/login`    |
| Recuperação/renovação | `POST /api/v1/auth/refresh`  |
| Logout                | `POST /api/v1/auth/logout`   |
| Atualização do perfil | `PATCH /api/v1/users/me`     |

O cadastro associa a conta ao `VITE_DEFAULT_MUNICIPALITY_ID` da implantação e exibe `VITE_DEFAULT_MUNICIPALITY_NAME`. Essa decisão evita apresentar um UUID ao cidadão e não inventa uma rota pública de municípios que não existe no back-end.

## Segurança e privacidade

- o access token permanece somente em memória;
- o refresh token permanece no cookie `httpOnly` gerenciado pela API;
- nenhum token ou senha é gravado em `localStorage` ou `sessionStorage`;
- o cliente faz no máximo uma renovação compartilhada após HTTP 401 e repete a requisição uma vez;
- logout limpa a sessão local mesmo se a chamada remota falhar;
- erros internos são convertidos em mensagens públicas e não exibem respostas sensíveis;
- `.env` local, `dist`, `coverage`, relatórios Playwright, logs e dependências permanecem ignorados pelo Git;
- somente nome, telefone e bairro são editáveis no perfil; e-mail, papel e município não podem ser alterados pela interface.

## Evidências automatizadas

| Verificação                              | Resultado                                                          |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `npm run validate` em `apps/citizen-web` | aprovado                                                           |
| ESLint                                   | aprovado                                                           |
| TypeScript estrito                       | aprovado                                                           |
| Vitest/Testing Library/MSW               | 10 arquivos e 40 testes aprovados                                  |
| Cobertura                                | 89,86% statements; 76,51% branches; 92,39% functions; 92,21% lines |
| Build Vite                               | aprovado; 179 módulos transformados                                |
| Playwright                               | 6 cenários aprovados em desktop e mobile                           |

Os E2E exercitam início/status, 404 e a jornada completa de cadastro, login, acesso ao perfil protegido e logout. Todos os cenários verificam que a largura do documento não ultrapassa a viewport, inclusive no perfil móvel de 390 px.

## Validação visual e manual

Foram inspecionadas as telas de cadastro, login e perfil com os serviços locais. O navegador confirmou landmarks, labels associados, textos de apoio, navegação dependente da sessão, ausência de erros de console e ausência de rolagem horizontal.

Para repetir:

1. na raiz, execute `npm run docker:up` e `npm run dev`;
2. em `apps/citizen-web`, copie `.env.example` para `.env` e execute `npm run dev`;
3. abra `http://localhost:5173/criar-conta` e conclua o cadastro;
4. entre em `http://localhost:5173/entrar`;
5. confirme o acesso e a atualização em `http://localhost:5173/perfil`;
6. use **Sair** e confirme o retorno ao login e o bloqueio de `/perfil`.

## Fora do escopo

Mapa interativo, novo relato, duplicidades, detalhes de ocorrências, notificações e interfaces administrativas continuam reservados às fases posteriores do PRD de continuação.
