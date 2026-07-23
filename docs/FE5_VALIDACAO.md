# FE‑5 — Relatório de validação

Data: 22 de julho de 2026

Branch: `codex/citizen-notifications`

Estado: concluída e aprovada pelo usuário em 22 de julho de 2026; pronta para publicação.

## Escopo entregue

- `/minhas-ocorrencias` com abas para ocorrências criadas e confirmadas, paginação e estados de carregamento, vazio e erro;
- `/notificacoes` com contador no cabeçalho, filtros de todas/não lidas, paginação e leitura individual ou em lote;
- `/perfil` ampliado com situação da conta, município, datas, atalhos, avatar HTTPS opcional e saída acessível no mobile;
- cabeçalho responsivo sem sobreposição em larguras pequenas;
- retorno seguro à ocorrência após autenticação preservado da FE‑4.

As avaliações pendentes pertencem à FE‑6 e não foram antecipadas nesta entrega.

## Compatibilidade do contrato

O contrato existente `GET /api/v1/occurrences/mine` lista somente ocorrências criadas pela pessoa autenticada. Não havia uma rota correta para obter todas as ocorrências confirmadas por ela; inferir essa relação a partir de notificações produziria uma lista incompleta e semanticamente incorreta.

Foi adicionada `GET /api/v1/occurrences/confirmed-by-me`, sem modificar rotas ou formatos existentes. A rota:

- exige sessão autenticada;
- aceita os mesmos filtros e paginação da listagem pessoal;
- filtra por uma confirmação realmente registrada em `occurrence_confirmations`;
- devolve a projeção pública sanitizada, sem autoria, endereço exato ou coordenadas precisas;
- está documentada no OpenAPI e coberta por testes unitários e de integração.

Impacto de compatibilidade: aditivo. Clientes existentes não precisam mudar. A alternativa rejeitada — derivar confirmações das notificações — poderia omitir registros, duplicar itens e depender do histórico de leitura.

## Segurança e privacidade

- rotas de conta permanecem protegidas pelo fluxo de sessão existente;
- refresh token continua somente em cookie `httpOnly` e access token somente em memória;
- a listagem de confirmações usa resposta pública sanitizada;
- a página de perfil mostra dados privados apenas à própria sessão;
- o avatar opcional aceita somente URL HTTPS e somente URLs HTTPS são renderizadas;
- mensagens de erro exibidas ao usuário passam pelo tratamento seguro do cliente HTTP;
- nenhum segredo ou credencial foi adicionado ao código ou às variáveis públicas `VITE_*`.

## Evidências automatizadas

| Verificação                        | Resultado                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Back-end `npm run validate`        | aprovado: lint, 207 testes e build                                            |
| Aplicativo `npm run validate`      | aprovado: lint, tipos, 79 testes e build                                      |
| Aplicativo `npm run test:coverage` | aprovado: 77,46% statements, 75,56% branches, 77,90% functions e 78,91% lines |
| Playwright `npm run test:e2e`      | aprovado: 18 cenários desktop/mobile                                          |
| Formatação                         | aprovada nos dois projetos                                                    |
| OpenAPI                            | 53 caminhos e 62 operações cobertos pelo teste de completude                  |

O build mantém apenas o aviso conhecido sobre o tamanho do chunk do MapLibre, sem falha ou regressão funcional. As execuções automatizadas usam um único worker para evitar contenção de recursos durante o carregamento instrumentado das rotas sob demanda; o modo interativo `test:watch` permanece disponível para desenvolvimento.

## Validação visual realizada

- 320 × 760: histórico pessoal, notificações e perfil sem sobreposição ou rolagem horizontal;
- 1440 × 900: histórico pessoal e notificações com cabeçalho completo e grade responsiva;
- API local, PostgreSQL/PostGIS e Adminer ativos durante a inspeção;
- dados reais de ocorrências próprias e notificações validados contra a API local;
- nenhuma mutação de leitura foi feita na conta do usuário durante a inspeção visual.

## Roteiro manual

1. Abra o Docker Desktop.
2. Na raiz, execute `npm run docker:up` e mantenha `npm run dev` em execução.
3. Em outro terminal, entre em `apps/citizen-web` e mantenha `npm run dev` em execução.
4. Acesse `http://localhost:5173` e autentique-se.
5. Abra **Minhas ocorrências** e alterne entre **Criadas por mim** e **Eu também vi**.
6. Abra **Avisos**, filtre por **Não lidas** e teste a leitura individual ou em lote.
7. Abra **Perfil**, confira os metadados, atualize somente os campos permitidos e teste **Encerrar sessão** no mobile.

Uma aba sem registros confirmados é um estado válido. A aprovação visual foi registrada, permitindo publicar a FE‑5 como o próximo PR empilhado.
