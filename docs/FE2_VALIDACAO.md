# FE‑2 — Relatório de validação

Data: 20 de julho de 2026.

## Resultado

A FE‑2 implementa o mapa público do aplicativo cidadão sobre os contratos existentes do back-end. A entrega foi validada visualmente e aprovada pelo usuário em 21 de julho de 2026, publicada na branch `codex/citizen-public-map` a partir do commit `5437295` e aberta para revisão no PR [#3](https://github.com/jhonmatos01/ta-na-rua/pull/3).

## Escopo entregue

- mapa público interativo em `/mapa`, com pontos e agrupamentos por proximidade;
- mapa-base viário Liberty, com ruas, bairros e pontos de referência derivados do OpenStreetMap;
- lista acessível paralela ao mapa, mantida mesmo quando o mapa base não carrega;
- filtros públicos por categoria, status e bairro;
- busca textual sobre a janela pública carregada;
- solicitação opcional da localização do navegador, sem envio da posição à API;
- alternativa manual para centralizar no município quando a localização não existe ou é negada;
- detalhes públicos em `/ocorrencias/:occurrenceId`, com categoria, imagem, descrição, endereço aproximado, confirmações, status, prioridade e linha do tempo;
- estados de carregamento, vazio, indisponibilidade e registro inexistente;
- layout responsivo e navegação por teclado em desktop e mobile.

## Contratos utilizados

| Operação                | Contrato existente                     |
| ----------------------- | -------------------------------------- |
| Pontos públicos do mapa | `GET /api/v1/occurrences/map`          |
| Catálogo/lista pública  | `GET /api/v1/occurrences`              |
| Detalhe público         | `GET /api/v1/occurrences/:id`          |
| Linha do tempo pública  | `GET /api/v1/occurrences/:id/timeline` |

As consultas públicas do mapa e dos detalhes são feitas deliberadamente sem o access token. Assim, mesmo uma pessoa autenticada recebe o contrato público sanitizado, sem coordenada exata ou campos privados disponíveis apenas ao autor.

## Busca e filtros

A API já suporta filtros por categoria, status e bairro, e esses valores são enviados diretamente nos parâmetros oficiais. Como não existe endpoint público de metadados nem busca textual no contrato atual, a interface monta as opções a partir do catálogo público carregado e aplica a busca textual localmente sobre até 100 ocorrências públicas. O mapa continua vindo do endpoint geográfico oficial, limitado a 500 pontos.

Essa escolha evita alterar o back-end ou simular um contrato inexistente. Para volumes maiores, uma fase futura deverá acrescentar paginação incremental e busca pública no servidor antes de prometer pesquisa completa em todo o município.

## Segurança e privacidade

- autoria, e-mail, telefone, coordenadas exatas e razões internas não são renderizados;
- localização do navegador é usada somente em memória para centralizar o mapa;
- URLs de imagem aceitam apenas os protocolos `http` e `https`;
- respostas públicas são validadas com Zod antes de entrar na interface;
- erros internos da API não são exibidos diretamente;
- `.env`, build, cobertura, relatórios Playwright, logs e dependências continuam ignorados pelo Git;
- nenhuma rota administrativa ou contrato da API foi alterado.
- a fonte cartográfica permanece configurável por ambiente e a atribuição do provedor é preservada pelo MapLibre.

## Evidências automatizadas

| Verificação                | Resultado                                                          |
| -------------------------- | ------------------------------------------------------------------ |
| ESLint                     | aprovado                                                           |
| TypeScript estrito         | aprovado                                                           |
| Vitest/Testing Library/MSW | 14 arquivos e 53 testes aprovados                                  |
| Cobertura                  | 80,40% statements; 74,50% branches; 82,28% functions; 81,86% lines |
| Build Vite                 | aprovado; mapa carregado em um módulo separado sob demanda         |
| Playwright                 | 8 cenários aprovados em Chromium desktop e mobile                  |

Os testes cobrem dados reais conforme os contratos, filtros, busca local, detalhes, imagens indisponíveis, privacidade, registro inexistente, falhas de API, localização negada e retorno manual ao município. Os E2E também verificam ausência de rolagem horizontal.

## Roteiro visual e manual

1. na raiz, execute `npm run docker:up` e `npm run dev`;
2. em `apps/citizen-web`, copie `.env.example` para `.env` e execute `npm run dev`;
3. abra `http://localhost:5173/mapa`;
4. teste busca, categoria, status, bairro e limpeza dos filtros;
5. permita ou negue a localização e confirme que sempre existe a alternativa **Centralizar no município**;
6. selecione um ponto ou cartão e valide `/ocorrencias/:id`;
7. confirme que endereço e posição são aproximados e que nenhum dado pessoal é exibido;
8. repita em uma viewport móvel.

## Fora do escopo

Criação de relato, confirmação de duplicidade, acompanhamento da própria ocorrência, notificações e interfaces administrativas continuam reservados às fases seguintes do PRD de continuação.
