# Fase 11 — Primeiro lote: mídia, revisão e catálogos

Data: 6 de outubro de 2026. Estado: primeiro lote implementado; Fase 11 permanece em andamento.

Origem: [plano de continuidade](PLANO_CONTINUIDADE.md), relatório da reunião de junho de 2026 (moderação/privacidade e filtros), roteiro R01 (registro e atendimento) e telas do Canva. A aprovação histórica da Fase 10 não foi alterada.

## Entrega

- O diretório de uploads não é mais servido estaticamente. `GET /api/v1/media/:imageId` e URLs legadas `/uploads/...` consultam o vínculo no banco antes de ler o arquivo.
- O público só acessa foto `APPROVED` de ocorrência visível e não excluída. Autor, operador do mesmo município, moderador e administrador têm acesso privado conforme suas permissões. Outro cidadão ou operador de outro município não acessa a foto pendente. Token inválido, usuário inativo e sessão revogada continuam sujeitos à autenticação existente.
- Respostas binárias usam `Cache-Control: private, no-store` e `Vary: Authorization`. URLs antigas compartilham o rate limit da API; arquivo órfão no disco não pode ser lido publicamente.
- Respostas de ocorrências usam URLs da API, sem expor a URL direta de storage. A serialização pública filtra também fotos não aprovadas nos detalhes.
- `GET /api/v1/moderation/images` lista imagens por estado, município e página. `PATCH /api/v1/moderation/images/:imageId` permite `APPROVED`, `REJECTED` ou `FLAGGED`, exclusivamente para `ADMIN` e `MODERATOR`.
- Uma decisão exige motivo e `expectedStatus`. A transação bloqueia a ocorrência e a imagem, modifica o estado e escreve auditoria com autor, motivo e estados anterior/novo. Revisão com estado esperado obsoleto retorna 409 sem sobrescrever a decisão anterior.
- Aprovar a imagem não publica a ocorrência. Revogar a aprovação bloqueia o acesso público pela mesma URL. Excluir logicamente a ocorrência bloqueia inclusive sua mídia para usuários autenticados.
- O frontend carrega mídia privada com Authorization, usando blobs temporários em memória, e oferece a fila de revisão com paginação e decisões. Na ausência do arquivo, mostra uma ilustração substituta.
- Catálogos públicos em `/api/v1/catalog/municipalities`, `/categories` e `/neighborhoods?municipalityId=...` usam os registros ativos do banco. Municípios não são mais fixos no código da interface.
- Cadastro/registro usam os catálogos; bairros dependem do município, e categoria permanece opcional no contrato existente. Sem IA configurada, omiti-la não produz classificação automática; a edição manual da classificação ainda precisa de um fluxo dedicado. A consulta de bairros exige UUID válido e município ativo.
- Lista e mapa compartilham município, bairro, categoria, status e `q`. Busca literal por título/descrição é aplicada no servidor antes da paginação; `%` e `_` não se tornam curingas.
- O frontend restringe as opções de status pela máquina existente e pelo perfil. Campos de atribuição, prazo, agendamento, resolução e duplicidade aparecem e são exigidos conforme a ação. O backend continua sendo a autoridade final.
- Uma criação com IA desativada informa revisão humana; não simula análise concluída.
- OpenAPI documenta os seis caminhos e seis operações novos. Inventário atual: 57 paths e 66 operações, mantendo os contratos históricos em `/api/v1`.

## Verificação reproduzível

Com Node.js 24 e dependências instaladas:

```bash
npm run validate
npm run test:coverage
npm run format:check
npm run build --prefix frontend
```

Banco real isolado, usando o PostgreSQL de desenvolvimento configurado no `.env`:

```bash
npm run validate:phase11
```

O comando exige ambiente não produtivo e permissão para criar uma base temporária. Aplica migrations e seed, sobe uma API em porta temporária com diretório de mídia próprio, executa 43 verificações HTTP e confere auditoria e arquivos. Encerra API/conexões e remove a base/diretório no bloco de limpeza. Não altera o banco normal do projeto.

Cenários: catálogos ativos, parâmetros inválidos, registro, autor/operador/moderador, isolamento municipal, URL nova/antiga, aprovação independente, revisão concorrente, publicação, busca por descrição, mapa filtrado, busca literal, revogação, auditoria, encaminhamento, reparo, avaliação e exclusão lógica.

Navegador, com API, banco e frontend locais iniciados:

```bash
npm ci --prefix frontend
npx --prefix frontend playwright install chromium
npm run test:e2e --prefix frontend
```

Três cenários Chromium cobrem catálogo/busca/mapa/mobile e registro com foto → leitura privada → fila de moderação → aprovação → publicação → encaminhamento pelo formulário. Usam dados sintéticos, contas fictícias documentadas do seed e exclusão lógica do registro de teste. A escrita de fixtures recusa hostname não local. `E2E_BASE_URL` permite selecionar outra porta local. Resultados e traces estão ignorados pelo Git.

Resultados desta rodada: suite do backend aprovada com 213 testes em 40 arquivos, novos testes HTTP de acesso/catálogo/rate limit aprovados, 43 verificações reais aprovadas, testes Chromium aprovados, build/lint/formatação aprovados. Cobertura verificada: 86,91% statements, 81,47% branches, 90% functions e 88,49% lines; metas existentes mantidas.

## Limites desta entrega

- Não há pipeline de desfoque, reencodificação ou remoção de EXIF. A aprovação atual é manual e entrega o arquivo aprovado. Separar original de cópia pública sanitizada continua no plano; não declarar que as fotos já estão anonimizadas.
- O adaptador de leitura S3 foi implementado, mas bucket/CDN reais não estão configurados nem validados. Eles devem ser privados e impedir leitura direta antes de uso público. URLs públicas anteriores, se existirem, precisam de revogação/invalidação na infraestrutura; o proxy da aplicação não altera permissões externas.
- O contrato da IA ainda usa as URLs de storage; um serviço externo precisará de acesso temporário controlado ao original. A IA permanece desativada no ambiente local.
- Este lote não inclui gestão completa de usuários/departamentos, recuperação de conta, todas as telas de perfil, edição de avaliações ou processamento assíncrono de IA.
- A base do frontend foi consolidada, mas sua separação em módulos/componentes ainda é trabalho do próximo lote.
- Não foi feita publicação externa. O piloto público continua condicionado aos requisitos de mídia, operação e infraestrutura do plano.

## Segundo lote — perfil e senha (6 de outubro de 2026)

Tela Minha conta acessível pelo nome no cabeçalho e pela navegação mobile. Consulta e edição de nome, telefone, bairro e município do cidadão usam `/users/me`; perfis operacionais mantêm o município exibido somente para consulta nesta tela. O e-mail permanece somente para consulta, conforme contrato atual.

Troca de senha exige confirmação no formulário, usa `/auth/change-password` e remove a sessão da interface após revogação das sessões pela API. Tokens continuam apenas em memória. Sessão/API e tela de conta foram extraídas para `frontend/src/api.js` e `frontend/src/account.js`.

O terceiro cenário Chromium cria uma conta temporária e verifica persistência após recarregar, divergência da confirmação, troca de senha, rejeição da senha antiga, entrada com a nova e layout mobile. Exclui logicamente a conta ao terminar. Os três cenários passaram; lint e build do frontend passaram. As métricas de cobertura acima referem-se ao primeiro lote do backend.

Gestão de departamentos/usuários, edição de avaliações e o restante da modularização seguem pendentes. Fase 11 permanece em andamento.

## Terceiro lote — departamentos e usuários (6 de outubro de 2026)

Tela de departamentos com filtros de município/estado e paginação, criação, edição de nome/descrição e ativação/desativação. Operadores usam o escopo municipal da API; moderadores e administradores podem filtrar municípios. Desativação preserva histórico. Nome/descrição e estado são salvos por chamadas separadas, conforme os endpoints existentes.

Tela de usuários exclusiva de ADMIN, com filtros de município/perfil/estado e paginação. O diálogo de acesso altera um atributo por vez, informa revogação das sessões e bloqueia opções de auto-bloqueio/remoção do próprio perfil administrativo. A API continua responsável pela autorização e auditoria. Contas excluídas aparecem somente para consulta. Os links de gestão ficam disponíveis também em Minha conta para uso mobile.

Implementação em `frontend/src/management.js`, sem novas migrations ou alterações nos contratos da API. O quarto cenário Chromium cria um departamento e uma conta temporários, edita e alterna o departamento, bloqueia/reativa o usuário, verifica rejeição da sessão antiga e altera o perfil. A limpeza desativa o departamento e exclui logicamente a conta; esses registros de auditoria permanecem no banco local.

Edição de avaliações, sanitização de mídia e demais critérios da Fase 11 permanecem pendentes.

Verificação do terceiro lote: lint, build Vite e quatro cenários Chromium aprovados. A API mantém o limite normal de requisições; repetições rápidas da suíte podem atingir HTTP 429. A rodada final passou sem modificar esse limite.
