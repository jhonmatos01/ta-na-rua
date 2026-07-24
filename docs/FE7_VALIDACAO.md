# FE‑7 — Relatório de validação

Data: 22 de julho de 2026

Branch: `codex/citizen-stabilization`

Estado: implementação e validação técnica concluídas; entrega aprovada e publicação autorizada pelo usuário em 24 de julho de 2026.

## Resultado entregue

- estabilização das jornadas cidadãs entregues da FE‑0 à FE‑6;
- auditoria WCAG automatizada com Axe em sete rotas, nos projetos desktop e mobile;
- auditoria Lighthouse reproduzível para a página inicial e o mapa público;
- esteira única `npm run validate:release` para lint, tipos, testes, build, E2E, PWA e Lighthouse;
- correções de contraste, semântica acessível e mensagem de carregamento de sessão;
- revisão visual em 320 × 760 e 1440 × 900, inclusive cabeçalho, mapa e detalhe público;
- roteiro de demonstração com inicialização após reinício da máquina e dados locais do seed;
- atualização das mensagens de fase e da documentação da versão candidata.

## Correções de acessibilidade

- A marca compacta passou a expor nome acessível por meio de `role="img"` e `aria-label`.
- Agrupamentos vermelhos e amarelos da prévia do mapa receberam cores com contraste suficiente.
- Números da jornada na página inicial receberam contraste suficiente sobre o fundo branco.
- Botões desabilitados deixaram de reduzir a opacidade de todo o conteúdo e preservam contraste legível.
- O estado de restauração da sessão passou a ser anunciado com `role="status"`.

A auditoria cobre WCAG 2.0 A/AA, WCAG 2.1 A/AA e WCAG 2.2 AA. Nenhuma regra foi excluída para obter aprovação.

## Validação automatizada

### Back-end preservado

- ESLint: aprovado.
- Testes: 207/207 aprovados em 40 arquivos.
- Build TypeScript: aprovado.
- `npm run validate`: aprovado.
- Cobertura: 88,67% statements, 82,49% branches, 91,11% functions e 90,76% lines.

### Aplicativo cidadão

- ESLint: aprovado.
- TypeScript estrito: aprovado.
- Vitest/RTL/MSW: 83/83 aprovados em 23 arquivos.
- Build Vite de produção: aprovado.
- Cobertura: 77,47% statements, 74,08% branches, 77,66% functions e 78,92% lines.
- Playwright funcional: 20/20 cenários aprovados em Chromium desktop e mobile.
- Axe/Playwright: 14/14 auditorias aprovadas em sete rotas desktop e mobile.
- PWA check: manifesto, service worker, fallback offline e ícones regulares e `maskable` aprovados.
- `npm audit`: zero vulnerabilidades conhecidas após a inclusão das ferramentas de auditoria.

O `npm audit --audit-level=high` da raiz terminou com código zero, mas registrou quatro alertas moderados preexistentes na cadeia de desenvolvimento `drizzle-kit` → `@esbuild-kit` → `esbuild`. A correção automática disponível exige uma alteração incompatível do `drizzle-kit`; por isso, não foi executado `npm audit fix --force`. O pacote não integra o bundle do aplicativo cidadão e deve ser atualizado em uma tarefa técnica específica.

## Lighthouse

Limites mínimos da FE‑7:

| Rota    | Desempenho | Acessibilidade | Boas práticas | SEO |
| ------- | ---------- | -------------- | ------------- | --- |
| `/`     | 80         | 90             | 90            | 80  |
| `/mapa` | 60         | 90             | 90            | 80  |

Resultado da execução final:

| Rota    | Desempenho | Acessibilidade | Boas práticas | SEO |
| ------- | ---------- | -------------- | ------------- | --- |
| `/`     | 91         | 100            | 96            | 91  |
| `/mapa` | 71         | 94             | 96            | 91  |

O mapa possui um limite de desempenho próprio porque carrega MapLibre e o estilo cartográfico externo. O pacote permanece isolado na rota `/mapa`; a página inicial não carrega esse módulo. A otimização adicional do motor cartográfico pode ser tratada depois da versão candidata sem retirar ruas, zoom ou interatividade.

## Validação visual e operacional

- PostgreSQL/PostGIS saudável na porta local 5433 e Adminer ativo na porta 8080.
- API ativa em `http://localhost:3333` e aplicativo em `http://localhost:5173`.
- Página inicial, mapa público e detalhe de ocorrência inspecionados em 320 × 760 e 1440 × 900.
- Sem sobreposição no cabeçalho móvel, rolagem horizontal ou erro no console.
- Mapa real do OpenFreeMap/OpenStreetMap exibiu ruas, bairros, marcadores, filtros e resultados.
- A navegação pública e os estados autenticados continuam usando os contratos existentes.

## Segurança e compatibilidade

- Nenhuma migration, tabela, relacionamento ou transformação de dados foi criada.
- Nenhum contrato da API, formato de token, regra de sessão ou autorização foi alterado.
- O service worker continua sem interceptar nem armazenar chamadas da API.
- As auditorias E2E usam respostas locais determinísticas e não registram senha, token ou cookie.
- O mapa continua sem chave secreta no navegador e com provedor configurável por variável pública.
- `node_modules`, `dist`, `coverage`, relatórios do Playwright e perfis temporários do Lighthouse permanecem ignorados.

## Aprovação e publicação

- Validação visual final: aprovada pelo usuário em 24 de julho de 2026.
- Commit e publicação da branch: autorizados.
- Estratégia: push sem reescrever o histórico e PR empilhado sobre a FE‑6.
- Publicação: commit `5d85b9a` na branch `codex/citizen-stabilization`, aberto para revisão no PR [#8](https://github.com/jhonmatos01/ta-na-rua/pull/8).
