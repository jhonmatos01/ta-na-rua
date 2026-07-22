# FE‑3 — Relatório de validação

Data: 21 de julho de 2026.

## Resultado

A FE‑3 implementa o fluxo autenticado de registro de ocorrências sobre os contratos existentes do back-end. A entrega foi validada visualmente e aprovada pelo usuário em 22 de julho de 2026 para commit e publicação na branch `codex/citizen-reporting`.

## Escopo entregue

- botão **Reportar** para sessões autenticadas e rota protegida `/nova-ocorrencia`;
- fluxo em três etapas: foto e relato, localização, revisão e envio;
- upload com câmera ou arquivo, prévia local, tipos JPEG/PNG/WebP e limite público configurável;
- título obrigatório, descrição e categoria opcionais;
- solicitação explícita da geolocalização sem aceitar posição em cache, com modo de alta precisão, margem informada pelo dispositivo e nova tentativa disponível;
- fallback pelo centro do município quando a permissão é negada ou indisponível;
- mapa viário com marcador arrastável, seleção por clique e campos numéricos acessíveis para corrigir o ponto;
- preenchimento aproximado de rua e bairro por geocodificação reversa autenticada, com atualização explícita após mover o marcador;
- endereço de referência editável e opção de publicação anônima;
- consulta de ocorrências próximas antes do envio;
- confirmação autenticada de um candidato existente ou decisão explícita de continuar com um novo registro;
- envio `multipart/form-data` com autenticação e resposta validada por Zod;
- protocolo de sucesso e mensagens seguras para imagem, localização, categoria, conflito e indisponibilidade, incluindo aviso de que a pendência ainda não está no mapa público;
- trava síncrona e botão desabilitado durante a requisição para impedir duplo clique e envio concorrente na interface.

## Contratos utilizados

| Operação                        | Contrato existente                                   |
| ------------------------------- | ---------------------------------------------------- |
| Catálogo opcional de categorias | `GET /api/v1/occurrences`                            |
| Candidatos próximos             | `GET /api/v1/occurrences/nearby`                     |
| Confirmar candidato existente   | `POST /api/v1/occurrences/:id/confirmations`         |
| Criar ocorrência                | `POST /api/v1/occurrences` com `multipart/form-data` |
| Buscar endereço aproximado      | `POST /api/v1/geocoding/reverse`                     |

O complemento aprovado da FE‑3 adicionou somente o contrato autenticado de geocodificação reversa, sem alterar contratos existentes de ocorrências. O raio de proximidade não é fixado pelo front-end; o parâmetro é omitido para preservar a configuração padrão do servidor.

## Decisões de integração

A API atual não possui um endpoint público de metadados para categorias, bairros ou limites de upload. A interface deriva opções de categoria do catálogo público e permite continuar sem seleção, pois `categoryId` é opcional no contrato de criação e a análise posterior pode sugerir a classificação. O limite inicial de imagem fica em `VITE_MAX_IMAGE_SIZE_MB=8`, alinhado ao padrão documentado do back-end; o servidor continua sendo a autoridade final e devolve uma mensagem clara se sua configuração for diferente.

A verificação prévia usa o endpoint público de proximidade e, portanto, recebe somente dados sanitizados. A confirmação de um candidato faz parte do fluxo obrigatório de duplicidades da FE‑3; a ação comunitária geral **Eu também vi**, sua remoção e o estado completo de confirmação nos detalhes permanecem na FE‑4.

## Prevenção de duplicidade

- um `ref` síncrono bloqueia duas chamadas disparadas antes do próximo render;
- o botão permanece desabilitado durante envio, consulta de proximidade ou confirmação em andamento;
- havendo candidatos, a criação exige marcar **É um problema diferente**;
- a confirmação existente usa a unicidade transacional do back-end e trata HTTP 409 sem quebrar a tela.

Essa proteção cobre clique repetido e concorrência no cliente. O contrato de criação não oferece chave de idempotência; por isso, um retry após perda ambígua da resposta não pode ter garantia absoluta sem uma futura decisão técnica e mudança compatível da API.

## Segurança e privacidade

- a prévia usa uma URL temporária revogada quando a imagem muda ou a página desmonta;
- geolocalização só é solicitada por ação explícita e não é consultada em segundo plano;
- a foto permanece local até a confirmação final; a coordenada é enviada antes apenas quando a pessoa solicita o endereço aproximado;
- a coordenada da busca segue em corpo `POST` autenticado, não na URL; o back-end não devolve nem registra o ponto na resposta do provedor;
- a API usa cache, coalescência, limite por usuário e intervalo externo mínimo de um segundo;
- o Nominatim público é apenas o fallback de desenvolvimento; produção exige por configuração uma instância dedicada HTTPS;
- mensagens internas, detalhes Zod e códigos técnicos não são exibidos diretamente;
- o navegador define o boundary multipart; o código não fixa `Content-Type` manualmente;
- access token permanece somente em memória e refresh token no cookie `httpOnly`;
- `.env`, build, cobertura, relatórios Playwright, dependências e uploads locais continuam ignorados pelo Git;
- nenhuma credencial ou segredo foi adicionado às variáveis `VITE_*`.

## Evidências automatizadas

| Verificação                | Resultado                                                          |
| -------------------------- | ------------------------------------------------------------------ |
| ESLint                     | aprovado                                                           |
| TypeScript estrito         | aprovado                                                           |
| Vitest/Testing Library/MSW | 18 arquivos e 66 testes aprovados                                  |
| Cobertura                  | 75,83% statements; 74,66% branches; 76,33% functions; 77,47% lines |
| Build Vite                 | aprovado; fluxo de registro carregado sob demanda                  |
| Playwright                 | 10 cenários aprovados em Chromium desktop e mobile                 |

Os testes cobrem validação de arquivo e localização, multipart autenticado, rota protegida, candidatos próximos, confirmação existente, envio único, protocolo de sucesso, mensagens seguras e ausência de rolagem horizontal. O E2E executa upload, localização manual, revisão e criação em desktop e mobile.

A API de geolocalização do navegador fornece coordenadas e uma margem de precisão, não o nome da rua. A FE‑3 rejeita leituras armazenadas (`maximumAge: 0`), solicita alta precisão e alerta quando a margem é grande. Após aprovação explícita, a coordenada pode ser convertida em rua e bairro pelo back-end; a interface avisa sobre a consulta ao provedor, exibe atribuição e preserva a correção manual como referência final.

O provedor de desenvolvimento segue a [API reversa do Nominatim](https://nominatim.org/release-docs/latest/api/Reverse/) e sua [política pública de uso](https://operations.osmfoundation.org/policies/nominatim/). A resposta representa o objeto adequado mais próximo e, por isso, nunca substitui a conferência visual do marcador.

Toda nova ocorrência nasce em `PENDING_REVIEW`. Por regra de privacidade do back-end, esse estado não aparece no mapa nem na lista pública; a tela de sucesso agora explica o período de revisão. O acompanhamento autenticado pelo contrato `GET /api/v1/occurrences/mine` pertence à futura tela **Minhas ocorrências**.

O build mantém o MapLibre em um módulo compartilhado carregado somente pelas páginas que usam mapas. O aviso de chunk acima de 500 kB é não bloqueante e corresponde principalmente à biblioteca cartográfica; o fluxo de registro ficou em aproximadamente 26 kB antes de compressão.

## Roteiro visual e manual

1. execute a API e o banco na raiz;
2. execute `npm run dev` em `apps/citizen-web`;
3. abra `http://localhost:5173` usando `localhost` para corresponder ao CORS local;
4. entre com um cidadão do seed e selecione **Reportar**;
5. escolha uma imagem válida, informe o título e avance;
6. permita ou negue a localização e confirme que **Marcar manualmente** sempre está disponível;
7. confirme o preenchimento aproximado de rua e bairro e a atribuição do provedor;
8. arraste o marcador, clique no mapa ou altere as coordenadas e use **Buscar endereço deste ponto**;
9. revise candidatos próximos e teste cada decisão;
10. envie uma única vez, confirme o protocolo e repita em viewport móvel.

## Fora do escopo

Lista de atividades próprias, acompanhamento privado, ação comunitária geral nos detalhes, remoção de confirmação, notificações e interfaces administrativas permanecem nas fases seguintes do PRD de continuação.
