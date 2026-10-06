# Plano de continuidade — Tá na Rua!

Data: 6 de outubro de 2026. Estado: plano proposto, sem implementação das novas fases neste documento.

## 1. Objetivo e fontes

Evoluir a base existente para uma plataforma comunitária de infraestrutura urbana: localizar → fotografar → revisar/classificar → publicar → mobilizar vizinhos → acompanhar atendimento → avaliar reparo → comparar resultados públicos.

O público prioritário são moradores, especialmente comunidades periféricas. Órgãos municipais são usuários operacionais e potenciais clientes do painel. A delimitação final do público duplo continua aberta no relatório da reunião. O produto deve permitir organização comunitária mesmo sem adesão da prefeitura; registrar um problema não significa que um órgão tenha recebido ou aceitado o chamado.

Fontes utilizadas:

| Fonte                                                                                            | Uso no plano                                                                                                                   |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| [README](../README.md), [PROGRESSO](PROGRESSO.md), [limitações](LIMITACOES.md), código e OpenAPI | Evidências do backend entregue, contratos e restrições técnicas                                                                |
| [Roteiro R01](referencias/ROTEIRO_R01.pdf), páginas 1–3                                          | Jornada, classificação por IA, agrupamento, compartilhamento, painel, estimativa de custo, ranking nacional e visão de negócio |
| [Relatório da reunião 06/2026](referencias/REUNIAO_06_2026.pdf), páginas 1–3                     | Público, rede social, antifraude, escopo municipal, moderação, privacidade, monetização e vídeos                               |
| [Canva — Apresentação Tá na Rua](https://canva.link/lcohac30mbj98xn), páginas 3–6 e 8–9          | Referência visual, interação, comparação e avaliação; não é um contrato técnico                                                |
| [Frontend](FRONTEND.md) e código em `frontend/`                                                  | Interface construída nesta sessão e funcionalidades ainda sem telas                                                            |

O texto integral do PRD Técnico Consolidado v1.2 não foi encontrado. Este plano reconcilia as fontes disponíveis; não substitui nem afirma reproduzir o PRD ausente. O código comprova implementação, não decide sozinho os requisitos de produto. Divergências são explicitadas abaixo.

## 2. Ponto de retomada

- O commit de origem `878b9eb` entrega o MVP do backend. O checklist registra fases 0–9 aprovadas e fase 10 tecnicamente concluída, aguardando aprovação final. Relatórios antigos de algumas fases conservam estados desatualizados.
- Na verificação desta sessão, lint, build e 199 testes passaram. Migrations, seed e schema também foram exercitados em PostgreSQL/PostGIS real, inclusive em base temporária limpa. Os testes automatizados existentes usam, em parte, repositórios em memória; não substituem a validação real do banco.
- Há 18 tabelas, 11 enums e uma máquina de estados com 24 transições. Reutilizar esses módulos e acrescentar migrations; não reconstruir o backend.
- A interface em `frontend/` foi acrescentada nesta sessão. Na elaboração deste plano, a interface e documentação ainda eram alterações locais sem commit. A consolidação da base e as entregas do primeiro lote estão registradas em [FASE11_VALIDACAO.md](FASE11_VALIDACAO.md); envio ao GitHub será uma ação separada.
- A interface oferece consulta, mapa, registro com foto, login, ocorrências próprias, confirmação, histórico, notificações, avaliação, operação básica de status e painel municipal. Build, lint e verificações Chromium passaram, incluindo upload real e sessão após recarga.
- IA, n8n e S3 possuem adaptadores/contratos, mas os serviços reais não estão configurados. A aplicação roda localmente; não há implantação pública.

## 3. Matriz de lacunas

| Necessidade                                       | Estado comprovado                                                    | Trabalho restante                                                                                     | Fonte                                  |
| ------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Registro de infraestrutura com foto e localização | Upload, GPS informado, PostGIS e protocolo implementados             | Captura pela câmera, evidências e UX de localização; não confundir GPS informado com prova antifraude | Reunião p. 1; roteiro p. 2             |
| Catálogo e filtros por bairro/categoria           | Tabelas e filtros na API; municípios fixos do seed na interface      | Endpoints de catálogo, seletores dinâmicos e busca no servidor                                        | Reunião p. 2; Canva p. 3               |
| Feed de proximidade                               | Consulta `/occurrences/nearby` e mapa existentes                     | Preferência de localidade, ordenação e navegação por bairro; atualização periódica explícita          | Reunião p. 3; roteiro p. 2             |
| Classificação automática                          | Cliente HTTP, schema, persistência e fallback                        | Serviço de IA real, acesso controlado às fotos e estado visível da análise                            | Roteiro p. 2; reunião p. 3             |
| Agrupamento                                       | Candidatos por proximidade, sugestões de IA e estado `DUPLICATE`     | Revisão, vínculo à ocorrência principal, evidências/contagens coerentes e desfazer vínculo            | Roteiro p. 2; contrato IA              |
| Compartilhar e confirmar                          | Link compartilhável, `Eu também vi` e prioridade existentes          | Atalho WhatsApp, estado da confirmação e continuidade do link no login                                | Roteiro p. 2; Canva p. 4               |
| Comentários comunitários                          | Não há módulo de comentários                                         | API, persistência, moderação, denúncias e tela de discussão                                           | Reunião p. 1; Canva p. 4               |
| Moderação de fotos e denúncias                    | Enum de moderação, imagem inicialmente `PENDING`, filtros de leitura | Fila e ações de revisão de imagens, botão denunciar, tratamento de conteúdo e trilha de auditoria     | Reunião p. 3                           |
| Proteção de rostos e mídia                        | Não há pipeline de desfoque comprovado                               | Original privado, cópia pública sanitizada, metadados removidos e processamento auditável             | Reunião p. 3                           |
| Gestão e atendimento                              | Status, atribuição, departamentos e autorização na API               | Fila de trabalho, formulários por transição, telas administrativas e evidências do reparo             | Roteiro p. 2; Canva p. 5               |
| Avaliar a solução                                 | Notas, vínculo do avaliador e contestação automática implementados   | Fotos antes/depois, resumo público, edição no prazo e comunicação da contestação                      | Roteiro p. 2; reunião p. 1; Canva p. 9 |
| Rankings                                          | Ranking de prioridade das ocorrências existe                         | Rankings de cidadãos, bairros e municípios são funcionalidades distintas e ainda ausentes             | Reunião pp. 1, 3; roteiro pp. 2–3      |
| Estimativa de custo                               | Não existe no contrato atual da IA                                   | Dados locais, unidade de medida, faixa de custo, confiança e revisão técnica                          | Roteiro p. 2                           |
| Monetização e GOV.BR                              | Sem cobrança, anúncios ou login GOV.BR implementados                 | Definição comercial, entitlements, pagamentos e integrações futuras                                   | Roteiro p. 3; reunião p. 2             |
| Reels                                             | Upload aceita apenas imagens                                         | Pipeline, transcodificação, moderação e custos de vídeo                                               | Reunião p. 3                           |

### Riscos concretos a resolver antes do piloto público

1. **Imagens em revisão:** `src/app.ts` serve o diretório local `/uploads` por rota estática. Filtrar imagens `PENDING` no JSON não impede acesso por quem obtiver a URL. Implementar acesso privado ao original e publicação somente da versão aprovada/sanitizada; validar também a política do bucket S3.
2. **Revisão de imagens incompleta:** a foto nasce `PENDING`, mas não foi identificado um fluxo dedicado completo de aprovação na interface/API. Validar e fechar o ciclo de ocorrência e imagem; mudar o status da ocorrência não deve deixar o tratamento da foto implícito.
3. **Localidade:** a validação atual usa município mais próximo e limite de distância, não polígonos de limites municipais. Tratar como validação aproximada até integrar uma base geográfica apropriada.
4. **Antifraude:** foto, GPS, timestamp e confirmação são sinais, não garantias de autenticidade. Câmera do navegador e EXIF não tornam fraude impossível. Definir indicadores de confiança e revisão sem prometer comprovação absoluta.

## 4. Decisões propostas para conciliar as fontes

Estas são recomendações de produto; itens divergentes continuam sujeitos à definição da equipe, sem bloquear a preparação das entregas básicas.

| Tema                                  | Divergência ou indefinição                                                                | Recomendação para a primeira entrega                                                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agrupamento automático                | Roteiro promete agrupamento automático; contrato atual proíbe fusão automática por IA     | Sugerir ocorrência existente antes do envio e oferecer confirmação; revisão humana para vínculo de duplicidade. Preservar autor, relatos, histórico e auditoria                  |
| Gratuidade versus impulsionamento     | Documentos prometem uso gratuito, mas a reunião considera posts/comentários pagos na fila | Consulta, relato, confirmação e avaliação gratuitos. Separar eventual visibilidade patrocinada da prioridade técnica de reparo; definir a política antes de implementar cobrança |
| Público do ranking                    | Roteiro fala em prefeituras; reunião inclui vereadores/gestores e reputação de cidadãos   | Começar com indicadores agregados de municípios/bairros. Ranking de pessoas exige metodologia e vínculo institucional definidos                                                  |
| Selo verificado versus resolutividade | Reunião menciona selo pago e selo por desempenho                                          | Distinguir identidade verificada de qualidade do atendimento; pagamento não comprova desempenho                                                                                  |
| Participação sem prefeitura           | Visão comunitária independente e painel B2G coexistem                                     | Cidadãos podem registrar e acompanhar. Exibir separadamente o status comunitário e a atuação institucional comprovada                                                            |
| Dados anonimizados                    | Pitch trata dados como produto comercial; regras detalhadas ausentes                      | Começar com estatísticas agregadas e limites contra identificação em grupos pequenos; definir finalidade, retenção e governança antes da venda                                   |
| Viabilidade financeira                | Roteiro apresenta exemplo de 10 contratos de R$500/mês                                    | Tratar como hipótese comercial a validar com custos, adesão e operação; não como receita ou sustentabilidade comprovadas                                                         |
| GOV.BR                                | Roteiro apresenta como próximo passo                                                      | Integração futura, dependente de elegibilidade, acesso e requisitos do serviço; manter autenticação atual no piloto                                                              |

## 5. Sequência de execução

As fases abaixo continuam a numeração histórica sem marcar a Fase 10 como aprovada automaticamente. Uma fase só é concluída com entregas verificáveis; maturidade das funcionalidades sociais não deve ser inferida da conclusão anterior do backend.

### Fase 11 — Consolidar a base e fechar o ciclo operacional

Prioridade imediata. Reutiliza principalmente funcionalidades já existentes e corrige lacunas que impedem operação real.

- Versionar a primeira interface e documentos com commits claros, preservando o estado do backend.
- Criar catálogo público de municípios ativos, bairros e categorias; derivar o município do usuário e permitir filtros válidos.
- Trocar municípios fixos e busca restrita à página por dados e busca do servidor; integrar filtros no mapa e na lista.
- Criar telas de revisão, atribuição e atendimento. Exibir somente transições permitidas para o perfil e status atual, com os campos exigidos pelo backend.
- Criar revisão explícita de imagens e fechar o acesso à mídia pendente/rejeitada. Separar original privado de imagem pública aprovada.
- Mostrar os estados reais de IA: integração desativada, análise em andamento, concluída ou revisão necessária. Não anunciar “validado por IA” no fallback.
- Completar perfil/senha, departamentos, administração de usuários, resumo/edição de avaliação e notificações individuais.
- Organizar a interface em módulos de API, sessão, telas e componentes, antes de acrescentar novas jornadas ao arquivo principal. Não trocar a tecnologia apenas para reorganizar código.
- Converter as verificações de navegador desta sessão em testes reproduzíveis no projeto, com usuários de teste e limpeza de dados isolada.

**Critério de saída:** dois cidadãos de municípios diferentes, um moderador e um operador executam, em banco real, registro → revisão de imagem → publicação → confirmação → atribuição → atendimento → reparo → avaliação/contestação. O cidadão não executa ações operacionais, o operador não acessa outro município e uma URL de mídia pendente não permite leitura pública. Não há catálogo fixo do seed na interface.

### Fase 12 — Comunidade e proteção contra abuso

Depende da base operacional e do acesso privado à mídia da Fase 11.

- Implementar comentários paginados com autoria controlada, edição/exclusão, regras de visibilidade e auditoria de moderação.
- Implementar denúncias categorizadas e fila de revisão para conteúdo impróprio, ofensa, exposição pessoal e conteúdo fora de escopo. Reutilizar permissões administrativas; acrescentar tabelas/migrations para denúncias e decisões.
- Refinar o feed por bairro/proximidade, atalhos WhatsApp, links diretos e retorno ao registro após login.
- Implementar captura pela câmera, permissão de GPS e sinais de procedência; considerar uma alternativa acessível quando câmera/localização não estiverem disponíveis, com revisão explícita.
- Remover metadados públicos e incorporar sanitização/desfoque, com estados de processamento e revisão manual. Imagens pendentes não podem vazar por CDN/cache.
- Registrar evidências de reparo, antes/depois e confirmação comunitária de solução sem duplicar ou alterar silenciosamente as regras existentes de avaliação/contestação.

**Critério de saída:** vizinhos encontram uma ocorrência por localidade, comentam, compartilham, confirmam e denunciam conteúdo; um moderador trata a denúncia com motivo auditado. Dados privados do cidadão e originais de imagens não aparecem em consulta pública. Conteúdo de segurança pública/crimes é tratado como fora do escopo de infraestrutura municipal.

### Fase 13 — IA real e revisão de duplicidades

Depende do pipeline privado de imagens; pode ser preparada junto com a Fase 12 após fechar os contratos.

- Definir e integrar um serviço real para categoria, gravidade, risco e sugestões de duplicidade; testar com imagens representativas e consentidas, inclusive fotos ambíguas ou inadequadas.
- Versionar o contrato da IA para moderação e imagens sanitizadas. O enum `CONTENT_MODERATION` existente não equivale a um serviço de moderação/desfoque pronto.
- Garantir que a IA acesse a imagem com URL temporária ou outro mecanismo controlado; `/uploads` relativo ou `localhost` não é acessível a um serviço externo.
- Avaliar processamento assíncrono: hoje a criação aguarda a análise, com até duas tentativas de timeout padrão de oito segundos. Retornar o registro preservado e atualizar o estado sem bloquear longamente a experiência móvel.
- Criar interface de revisão das sugestões, vínculo à ocorrência principal e desfazer vínculo com auditoria. Reconciliar confirmação/relatos sem contar o mesmo cidadão duas vezes.
- Preservar timeout, retry limitado, idempotência e fallback. IA não pode mudar unilateralmente a prioridade por regras novas ou encerrar uma ocorrência.
- Preparar estimativas de reparo como módulo posterior: catálogo regional de serviços, unidades, faixa de valores, data de referência e validação humana. Não usar um valor livre gerado pelo modelo como orçamento oficial.

**Critério de saída:** medir qualidade de classificação e falsos agrupamentos em conjunto de avaliação definido antes do teste. Fotos ambíguas exigem revisão, falha externa não perde ocorrência e reprocessamento não duplica resultados. As metas numéricas de qualidade serão fixadas com a amostra; não há taxa de acerto comprovada hoje.

### Fase 14 — Transparência, comparação e engajamento

Depende do ciclo de reparo validado e de dados consistentes. Indicadores podem ser preparados antes, mas não publicados como ranking confiável sem amostra suficiente.

- Publicar métricas de municípios e bairros: resolução, tempo até primeiro atendimento, tempo até reparo, avaliações e distribuição de infraestrutura por categoria.
- Definir período, denominadores, tamanho mínimo da amostra, dados ausentes, ocorrências contestadas, duplicidades e diferenças de cobertura entre regiões.
- Implementar comparação territorial e série temporal com filtros e exportação. Distinguir tempo de resposta de tempo de resolução.
- Definir fórmula pública para ranking e selos de resolutividade; mostrar período/metodologia e permitir auditoria/correção.
- Propor reputação de colaboração válida e badges sem premiar spam. Não mudar os pesos da prioridade existente sem uma decisão explícita de produto e avaliação do efeito sobre bairros com menor participação digital.

**Critério de saída:** indicadores reproduzíveis a partir de dados de teste conhecidos, municípios sem amostra exibidos como “dados insuficientes”, ausência de dados pessoais e notas comparáveis apenas dentro da metodologia publicada. Ranking de cidadãos e ranking de gestão municipal são produtos separados.

### Fase 15 — Piloto público e operação confiável

Começar a preparação operacional nas fases anteriores; publicar após os controles básicos das fases 11–12 e o ciclo de atendimento passarem.

- Selecionar um município/bairro piloto, validar cadastro geográfico e responsáveis por moderação/atendimento. Confirmar a adesão institucional antes de atribuir ações à prefeitura.
- Validar com moradores, especialmente de áreas periféricas: linguagem, acessibilidade, celulares simples, conexão lenta e localização sem GPS.
- Escolher infraestrutura; hospedar frontend com proxy para API, HTTPS, banco persistente, storage privado/público separado e gestão de segredos.
- Configurar recuperação de conta, backups com teste de restauração, monitoramento, alertas, atualização das dependências e operação da fila/outbox.
- Configurar n8n e canais externos quando existirem destinos reais; testar assinaturas, idempotência e recuperação de falhas. Webhook normalizado não é um bot conversacional pronto.
- Definir consentimento, regras de uso, retenção de originais e procedimento de denúncia/exclusão para o piloto, com responsabilidades atribuídas.

**Critério de saída:** URL HTTPS acessível fora deste workspace, restauração de backup demonstrada, fluxo de cadastro/atendimento validado por moradores e responsáveis operacionais, monitoramento funcionando e métricas reais do piloto registradas. Medir registro concluído, participação por bairro, revisão pendente, tempo de atendimento, reparos avaliados e contestados. Não depender apenas do número de downloads ou postagens.

### Fase 16 — Sustentabilidade e expansão

Depende do piloto e da definição comercial. Não bloqueia a participação gratuita.

- Validar B2G/B2B com potenciais clientes e custos de storage, IA, moderação e suporte antes de implementar planos e cobrança.
- Separar permissões comerciais do controle municipal já existente; assinatura não substitui autenticação/isolamento.
- Avaliar relatórios agregados, publicidade local e perfis institucionais verificados; definir política de transparência e de conteúdo patrocinado.
- Estudar GOV.BR, integração com sistemas municipais e expansão territorial com dados geográficos confiáveis.
- Planejar reels somente após demanda comprovada e capacidade de processamento/moderação/custeio de vídeo.

**Critério de saída:** modelo validado por piloto/cliente, contrato e métricas do serviço definidos; nenhuma cobrança para registro/consulta/participação comunitária básica. Qualidade do atendimento não pode ser confundida com compra de selo.

## 6. Primeiro lote concreto de trabalho

Ordem recomendada para começar sem depender da escolha de fornecedor de IA ou hospedagem:

1. Consolidar os arquivos locais e um inventário de rotas/telas, mantendo o histórico de aprovação separado.
2. Resolver o acesso às imagens pendentes e implantar fila de revisão com ações auditadas.
3. Implementar endpoints de catálogo e seletores dinâmicos; acrescentar busca no servidor e filtros compartilhados entre mapa/lista.
4. Completar o ciclo de atendimento no frontend, com ações compatíveis com perfil/status e evidência de resolução.
5. Registrar testes reproduzíveis do ciclo completo em banco isolado e do controle de acesso à mídia.

A divisão em fases representa dependências e prioridade, não estimativas de prazo. Estimar duração após dividir cada fase em tarefas com responsáveis, capacidade da equipe e critérios de aceite.

## 7. Regras de acompanhamento

- Cada nova entrega deve registrar requisitos de origem, migration/contrato quando aplicável, telas, critérios de aceite e evidência de validação.
- Atualizar `PROGRESSO.md` com novos blocos sem reescrever as aprovações anteriores nem marcar a Fase 10 como aprovada por inferência.
- Novas tabelas para comentários, denúncias, reputação ou faturamento serão adicionadas por migrations; não editar migrations já executadas.
- Testar com dados sintéticos/consentidos e base isolada. Preservar registros reais, histórico e auditoria.
- Publicação externa, contratação de serviços e escolhas de regras ainda divergentes são decisões posteriores. Este plano não configura integrações nem publica o produto.
