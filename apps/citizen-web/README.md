# Tá na Rua! — aplicativo cidadão (FE‑0)

Fundação técnica e visual da interface pública do projeto. Esta entrega cria a base responsiva, acessível e testável para as jornadas cidadãs das próximas fases, sem antecipar autenticação, mapa ou registro de ocorrências.

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

| Rota            | Finalidade                                         |
| --------------- | -------------------------------------------------- |
| `/`             | apresentação da fundação e resumo da saúde da API  |
| `/status`       | saúde pública da API e do banco de dados           |
| `/indisponivel` | mensagem segura para funcionalidades indisponíveis |
| `*`             | página 404                                         |

## Configuração pública

Todas as variáveis `VITE_*` são incorporadas ao cliente e, portanto, devem ser tratadas como públicas. Nunca coloque token, senha, segredo JWT ou credencial nessas variáveis.

| Variável                      | Uso                                            |
| ----------------------------- | ---------------------------------------------- |
| `VITE_APP_NAME`               | nome público da aplicação                      |
| `VITE_APP_VERSION`            | versão exibida no rodapé                       |
| `VITE_API_BASE_URL`           | URL pública da API                             |
| `VITE_API_TIMEOUT_MS`         | limite por consulta HTTP                       |
| `VITE_ENABLE_API_STATUS`      | habilita a consulta de `/health`               |
| `VITE_ENABLE_DATABASE_STATUS` | habilita a consulta de `/health/database`      |
| `VITE_ENABLE_DEVTOOLS`        | reserva controlada para ferramentas de suporte |

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
|-- features/status/  contratos e consultas de saúde
|-- layouts/          estrutura de navegação, conteúdo e rodapé
|-- lib/              cliente HTTP, erros seguros e TanStack Query
|-- pages/            páginas correspondentes às rotas públicas
`-- tests/            MSW, servidor simulado e utilitários de render
e2e/                  cenários desktop e mobile do Playwright
public/               manifesto e identidade mínima para preparação PWA
```

O cliente HTTP adiciona request ID, timeout, cancelamento, cookies preparados para autenticação futura e validação Zod da resposta. Mensagens técnicas da API não são exibidas diretamente à pessoa usuária.

## Escopo e evidências

- [Direção visual do aplicativo cidadão](../../docs/DIRECAO_VISUAL_CIDADAO.md)
- [Relatório de validação FE‑0](../../docs/FE0_VALIDACAO.md)
- [Limitações conhecidas FE‑0](../../docs/FE0_LIMITACOES.md)
