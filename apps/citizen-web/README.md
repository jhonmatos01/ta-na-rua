# Tá na Rua! — aplicativo cidadão (FE‑2)

Aplicação cidadã responsiva e acessível do projeto. A FE‑2 preserva autenticação e perfil da FE‑1 e acrescenta mapa público, agrupamentos, filtros, busca local e detalhes de ocorrências integrados à API existente.

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
| `VITE_MAP_STYLE_URL`             | estilo viário público compatível com MapLibre     |
| `VITE_MAP_DEFAULT_LATITUDE`      | latitude inicial pública do município             |
| `VITE_MAP_DEFAULT_LONGITUDE`     | longitude inicial pública do município            |
| `VITE_MAP_DEFAULT_ZOOM`          | aproximação inicial do mapa                       |

A inicialização falha de forma explícita se uma variável obrigatória estiver ausente ou inválida. O arquivo `.env` local é ignorado pelo Git; somente `.env.example` é versionado.

## Scripts

| Comando                 | Responsabilidade                    |
| ----------------------- | ----------------------------------- |
| `npm run dev`           | inicia o Vite em desenvolvimento    |
| `npm run lint`          | executa o ESLint                    |
| `npm run typecheck`     | valida TypeScript estrito           |
| `npm test`              | executa os testes Vitest/RTL/MSW    |
| `npm run test:coverage` | mede e valida a cobertura mínima    |
| `npm run test:e2e`      | executa os cenários Playwright      |
| `npm run build`         | gera o build de produção            |
| `npm run validate`      | executa lint, tipos, testes e build |

Na primeira execução dos E2E, instale o navegador de testes com `npx playwright install chromium`.

## Arquitetura

```text
src/
|-- components/       componentes reutilizáveis e acessíveis
|-- config/           validação do ambiente público com Zod
|-- features/auth/    sessão, contratos e regras de autenticação
|-- features/occurrences/ contratos, consultas e apresentação pública
|-- features/status/  contratos e consultas de saúde
|-- layouts/          estrutura de navegação, conteúdo e rodapé
|-- lib/              cliente HTTP, erros seguros e TanStack Query
|-- pages/            páginas correspondentes às rotas públicas
`-- tests/            MSW, servidor simulado e utilitários de render
e2e/                  cenários desktop e mobile do Playwright
public/               manifesto e identidade mínima para preparação PWA
```

O cliente HTTP adiciona request ID, timeout, cancelamento, cookie de sessão, access token em memória e validação Zod da resposta. Uma resposta 401 tenta uma única renovação compartilhada antes de encerrar a sessão. Senhas, access tokens e refresh tokens não são persistidos em `localStorage` ou `sessionStorage`; mensagens técnicas da API não são exibidas diretamente à pessoa usuária.

O cadastro usa o município público configurado pela implantação. A interface não solicita que a pessoa usuária digite ou descubra um UUID e não cria contratos de API inexistentes.

O mapa usa `GET /api/v1/occurrences/map`; filtros e catálogo usam `GET /api/v1/occurrences`; detalhes e linha do tempo usam seus respectivos contratos públicos. Essas chamadas não enviam access token, preservando sempre a resposta pública sanitizada. Como a API atual não possui busca textual pública, a busca é aplicada sobre até 100 ocorrências carregadas e essa limitação é exibida na interface.

O ambiente de desenvolvimento usa o estilo viário **Liberty**, fornecido pelo OpenFreeMap com dados do OpenStreetMap. Ele apresenta ruas, bairros e pontos de referência sem exigir chave no cliente. A URL continua externa e configurável por `VITE_MAP_STYLE_URL`, permitindo usar um provedor contratado ou uma infraestrutura própria no deploy de produção.

## Escopo e evidências

- [Direção visual do aplicativo cidadão](../../docs/DIRECAO_VISUAL_CIDADAO.md)
- [Relatório de validação FE‑1](../../docs/FE1_VALIDACAO.md)
- [Relatório de validação FE‑2](../../docs/FE2_VALIDACAO.md)
- [Relatório de validação FE‑0](../../docs/FE0_VALIDACAO.md)
- [Limitações conhecidas FE‑0](../../docs/FE0_LIMITACOES.md)
