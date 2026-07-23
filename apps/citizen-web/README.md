# Tá na Rua! — aplicativo cidadão (FE‑6)

Aplicação cidadã responsiva, acessível e instalável. A FE‑6 preserva as jornadas anteriores e acrescenta avaliação pós-reparo, pendências pessoais, abertura direta por notificação, resumo público e operação como PWA.

## Pré-requisitos

- Node.js 24 ou superior;
- npm;
- API local do projeto em `http://localhost:3333` para o teste integrado;
- Docker Desktop para a verificação real do banco pela API.

## Executar localmente

Na raiz do repositório, inicie a API:

```powershell
npm run docker:up
npm run dev
```

Após reiniciar o computador, confirme primeiro que o Docker Desktop está aberto. O comando `npm run docker:up` inicia ou recupera PostgreSQL/PostGIS e Adminer; `npm run dev` mantém a API no terminal atual. Não feche esse terminal enquanto estiver testando.

Em outro terminal:

```powershell
Set-Location apps/citizen-web
npm install
Copy-Item .env.example .env
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173). Use `localhost`, e não `127.0.0.1`, para corresponder à origem CORS local configurada no back-end.

## Rotas

| Rota                         | Acesso      | Finalidade                                          |
| ---------------------------- | ----------- | --------------------------------------------------- |
| `/`                          | público     | apresentação e resumo da saúde da API               |
| `/status`                    | público     | saúde pública da API e do banco de dados            |
| `/entrar`                    | público     | login da conta cidadã                               |
| `/criar-conta`               | público     | cadastro no município configurado                   |
| `/perfil`                    | autenticado | consulta e atualização dos dados permitidos         |
| `/minhas-ocorrencias`        | autenticado | ocorrências criadas e confirmadas pela pessoa       |
| `/notificacoes`              | autenticado | avisos, filtros e controle de leitura               |
| `/avaliar/:occurrenceId`     | autenticado | criação ou edição da avaliação do reparo            |
| `/nova-ocorrencia`           | autenticado | foto, localização, duplicidades, revisão e envio    |
| `/mapa`                      | público     | mapa, filtros, busca e lista pública de ocorrências |
| `/ocorrencias/:occurrenceId` | público     | detalhe e linha do tempo públicos da ocorrência     |
| `/indisponivel`              | público     | mensagem segura para funcionalidades indisponíveis  |
| `*`                          | público     | página 404                                          |

## Configuração pública

Todas as variáveis `VITE_*` são incorporadas ao cliente e, portanto, devem ser tratadas como públicas. Nunca coloque token, senha, segredo JWT ou credencial nessas variáveis.

| Variável                         | Uso                                               |
| -------------------------------- | ------------------------------------------------- |
| `VITE_APP_NAME`                  | nome público da aplicação                         |
| `VITE_APP_VERSION`               | versão exibida no rodapé                          |
| `VITE_API_BASE_URL`              | URL pública da API                                |
| `VITE_API_TIMEOUT_MS`            | limite por consulta HTTP                          |
| `VITE_ENABLE_API_STATUS`         | habilita a consulta de `/health`                  |
| `VITE_ENABLE_DATABASE_STATUS`    | habilita a consulta de `/health/database`         |
| `VITE_ENABLE_DEVTOOLS`           | reserva controlada para ferramentas de suporte    |
| `VITE_DEFAULT_MUNICIPALITY_ID`   | município associado ao cadastro desta implantação |
| `VITE_DEFAULT_MUNICIPALITY_NAME` | nome público do município exibido na interface    |
| `VITE_PASSWORD_MIN_LENGTH`       | tamanho mínimo de senha alinhado ao back-end      |
| `VITE_MAX_IMAGE_SIZE_MB`         | limite público validado antes do upload           |
| `VITE_MAP_STYLE_URL`             | estilo viário público compatível com MapLibre     |
| `VITE_MAP_DEFAULT_LATITUDE`      | latitude inicial pública do município             |
| `VITE_MAP_DEFAULT_LONGITUDE`     | longitude inicial pública do município            |
| `VITE_MAP_DEFAULT_ZOOM`          | aproximação inicial do mapa                       |

A inicialização falha de forma explícita se uma variável obrigatória estiver ausente ou inválida. O arquivo `.env` local é ignorado pelo Git; somente `.env.example` é versionado.

## Scripts

| Comando                 | Responsabilidade                       |
| ----------------------- | -------------------------------------- |
| `npm run dev`           | inicia o Vite em desenvolvimento       |
| `npm run lint`          | executa o ESLint                       |
| `npm run typecheck`     | valida TypeScript estrito              |
| `npm test`              | executa os testes Vitest/RTL/MSW       |
| `npm run test:coverage` | mede e valida a cobertura mínima       |
| `npm run test:e2e`      | executa os cenários Playwright         |
| `npm run build`         | gera o build de produção               |
| `npm run pwa:check`     | valida manifesto, SW, offline e ícones |
| `npm run validate`      | executa lint, tipos, testes e build    |

Na primeira execução dos E2E, instale o navegador de testes com `npx playwright install chromium`.

## Arquitetura

```text
src/
|-- components/       componentes reutilizáveis e acessíveis
|-- config/           validação do ambiente público com Zod
|-- features/auth/    sessão, contratos e regras de autenticação
|-- features/evaluations/ contratos e mutações de avaliação
|-- features/geocoding/ endereço aproximado autenticado
|-- features/notifications/ contratos e consultas de notificações
|-- features/occurrences/ contratos, mapa, duplicidades e registro
|-- features/pwa/     instalação e detecção do modo standalone
|-- features/status/  contratos e consultas de saúde
|-- layouts/          estrutura de navegação, conteúdo e rodapé
|-- lib/              cliente HTTP, erros seguros e TanStack Query
|-- pages/            páginas correspondentes às rotas públicas
`-- tests/            MSW, servidor simulado e utilitários de render
e2e/                  cenários desktop e mobile do Playwright
public/               manifesto, ícones, service worker e fallback offline
```

O cliente HTTP adiciona request ID, timeout, cancelamento, cookie de sessão, access token em memória e validação Zod da resposta. Uma resposta 401 tenta uma única renovação compartilhada antes de encerrar a sessão. Senhas, access tokens e refresh tokens não são persistidos em `localStorage` ou `sessionStorage`; mensagens técnicas da API não são exibidas diretamente à pessoa usuária.

O cadastro usa o município público configurado pela implantação. A interface não solicita que a pessoa usuária digite ou descubra um UUID e não cria contratos de API inexistentes.

O mapa usa `GET /api/v1/occurrences/map`; filtros e catálogo usam `GET /api/v1/occurrences`; detalhes e linha do tempo usam seus respectivos contratos públicos. Essas chamadas não enviam access token, preservando sempre a resposta pública sanitizada. Como a API atual não possui busca textual pública, a busca é aplicada sobre até 100 ocorrências carregadas e essa limitação é exibida na interface.

O ambiente de desenvolvimento usa o estilo viário **Liberty**, fornecido pelo OpenFreeMap com dados do OpenStreetMap. Ele apresenta ruas, bairros e pontos de referência sem exigir chave no cliente. A URL continua externa e configurável por `VITE_MAP_STYLE_URL`, permitindo usar um provedor contratado ou uma infraestrutura própria no deploy de produção.

O registro usa `GET /api/v1/occurrences/nearby` antes do envio e deixa o raio padrão sob controle do back-end. Um candidato pode receber a confirmação autenticada por `POST /api/v1/occurrences/:id/confirmations`; a criação de um problema diferente só é liberada após decisão explícita. O envio final usa `POST /api/v1/occurrences` com `multipart/form-data`, imagem inicial obrigatória e botão bloqueado enquanto a requisição está em andamento.

Ao solicitar a localização ou acionar **Buscar endereço deste ponto**, o aplicativo envia a coordenada em um `POST` autenticado para `/api/v1/geocoding/reverse`. A API consulta o provedor configurado, aplica cache e limites e devolve somente rua, bairro e demais campos sanitizados. Depois de mover o marcador, a pessoa precisa atualizar o endereço explicitamente. A atribuição do provedor permanece visível e o resultado é sempre apresentado como aproximado.

Nos detalhes públicos, `GET /api/v1/occurrences/:id/confirmations/count` mantém contador e prioridade sincronizados. Uma sessão de cidadão também recebe `confirmedByMe` e pode usar `POST /api/v1/occurrences/:id/confirmations` ou `DELETE /api/v1/occurrences/:id/confirmations/me`. HTTP 409 e remoção já sincronizada são reconciliados sem quebrar a tela. O compartilhamento envia somente título e URL pública; quando a Web Share API não está disponível, o aplicativo copia o link ou o apresenta para cópia manual.

O histórico pessoal usa `GET /api/v1/occurrences/mine` para registros próprios e o contrato aditivo `GET /api/v1/occurrences/confirmed-by-me` para confirmações da pessoa autenticada. A segunda resposta permanece sanitizada como resposta pública e não expõe autoria, endereço exato ou coordenadas precisas. As notificações usam os contratos existentes de listagem, contador e leitura; após cada mutação, lista e contador são sincronizados pelo TanStack Query.

A aba **Avaliar reparos** usa o contrato aditivo `GET /api/v1/occurrences/pending-evaluations`, que considera status, vínculo e ausência de avaliação no banco. A criação e edição usam os contratos de avaliações existentes; o navegador não duplica a regra de vínculo, janela de sete dias ou contestação automática. O resumo público contém somente agregados. Imagem não é solicitada porque o contrato atual não oferece upload e o PRD a define como condicional.

O build de produção registra `/sw.js`, disponibiliza manifesto e ícones PNG regulares e `maskable`, e oferece instalação no perfil. O service worker nunca intercepta ou armazena chamadas da API; quando uma navegação falha sem conexão, mostra apenas o fallback estático. Execute `npm run build && npm run pwa:check` para verificar os artefatos.

Como não existe endpoint público de metadados, a lista opcional de categorias é derivada do catálogo público carregado. Se o catálogo estiver indisponível ou não representar todas as categorias, a pessoa pode continuar sem selecionar e deixar a análise do back-end sugerir a classificação. Nenhum contrato da API foi alterado para contornar essa limitação.

## Escopo e evidências

- [Direção visual do aplicativo cidadão](../../docs/DIRECAO_VISUAL_CIDADAO.md)
- [Relatório de validação FE‑1](../../docs/FE1_VALIDACAO.md)
- [Relatório de validação FE‑2](../../docs/FE2_VALIDACAO.md)
- [Relatório de validação FE‑3](../../docs/FE3_VALIDACAO.md)
- [Relatório de validação FE‑4](../../docs/FE4_VALIDACAO.md)
- [Relatório de validação FE‑5](../../docs/FE5_VALIDACAO.md)
- [Relatório de validação FE‑6](../../docs/FE6_VALIDACAO.md)
- [Relatório de validação FE‑0](../../docs/FE0_VALIDACAO.md)
- [Limitações conhecidas FE‑0](../../docs/FE0_LIMITACOES.md)
