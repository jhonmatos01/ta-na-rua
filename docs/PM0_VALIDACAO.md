# PM‑0 — Fundação do Painel da Prefeitura

Data da implementação inicial: 24 de julho de 2026.

## Objetivo

Criar uma aplicação separada para a operação municipal, apoiada nos contratos já concluídos do back-end e sem misturar permissões administrativas com o aplicativo cidadão.

## Entregue

- aplicação Vite, React e TypeScript estrito em `apps/municipal-web`;
- identidade visual responsiva inspirada na direção aprovada para o produto;
- login real em `POST /api/v1/auth/login`;
- restauração da sessão por refresh em cookie `httpOnly`;
- token de acesso mantido apenas em memória;
- bloqueio explícito do perfil `CITIZEN`;
- acesso permitido somente a `CITY_OPERATOR`, `MODERATOR` e `ADMIN`;
- logout que encerra a sessão local mesmo em indisponibilidade da API;
- proxy local em `http://localhost:5174` para evitar dependência adicional de CORS;
- visão geral real com resumo, ranking de prioridades e categorias;
- escopo municipal imposto pelo back-end para o operador;
- estados de carregamento, vazio e falha com nova tentativa;
- layout adaptado para desktop, tablet e celular;
- política `Cross-Origin-Resource-Policy: cross-origin` limitada a `/uploads`, permitindo que
  imagens públicas servidas pela API sejam incorporadas pelo aplicativo em outra porta ou origem;
  as demais respostas preservam `same-origin`.

## Chamados de demonstração

O seed agora copia duas imagens fictícias versionadas para o armazenamento local e atualiza de forma idempotente os registros correspondentes:

| Chamado                                 | Tipo da imagem | URL local                                                |
| --------------------------------------- | -------------- | -------------------------------------------------------- |
| Buraco em via de demonstração           | `INITIAL`      | `/uploads/fixtures/phase-1/pothole-before-repair.png`    |
| Poste apagado resolvido em demonstração | `AFTER_REPAIR` | `/uploads/fixtures/phase-1/streetlight-after-repair.png` |

Os dois arquivos responderam HTTP 200 com `Content-Type: image/png` pela API.

## Evidências técnicas

- validação integral do back-end: lint, build e 208 testes aprovados;
- `npm run db:seed`: aprovado;
- `npm run db:validate`: aprovado;
- `npm run validate` em `apps/municipal-web`: lint, tipos e build aprovados;
- dependências do painel: zero vulnerabilidades reportadas pelo `npm install`;
- login pelo proxy local: perfil `CITY_OPERATOR` de Salvador;
- dashboard pelo proxy local: 5 ocorrências, 4 ativas e 5 itens priorizados;
- build produzido com 272,05 kB de JavaScript bruto e 82,22 kB gzip;
- as duas imagens foram renderizadas no navegador em desktop e mobile, sem rolagem horizontal.

## Como testar

Com Docker e API já iniciados:

```powershell
cd "C:\Users\Jhonjhon\Documents\New project\apps\municipal-web"
npm run dev
```

Abra `http://localhost:5174` e use:

- e-mail: `bruno.operador@example.test`;
- senha: `Operador123!Fase2`.

O painel, o aplicativo cidadão e os dois chamados foram validados no navegador local. A
disponibilidade também foi confirmada diretamente no Windows e o fluxo operacional foi validado
pelo proxy HTTP.

## Próximo recorte

PM‑1 deve transformar a visão geral em uma fila operacional navegável:

- filtros de status, categoria, bairro e período;
- paginação;
- detalhes do chamado com imagem, localização aproximada e histórico;
- preservação do escopo municipal;
- estados de URL compartilháveis;
- validação visual do painel pelo usuário antes da publicação.
