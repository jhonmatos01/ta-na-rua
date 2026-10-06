# Frontend — Tá na Rua!

## Origem do escopo

O PRD Técnico Consolidado v1.2 é citado em `PROGRESSO.md`, mas seu texto integral não está versionado neste repositório. Esta primeira versão do frontend deriva do README, do checklist, do contrato do painel e das rotas e schemas do backend. Não representa uma validação integral contra o PRD original.

## Executar localmente

Use Node.js 24. Com o backend configurado, execute na raiz:

```bash
docker compose up -d --wait
npm run db:migrate
npm run db:seed
npm run dev
```

Em outro terminal:

```bash
npm ci --prefix frontend
npm run dev --prefix frontend
```

Abra `http://localhost:5173`. O Vite encaminha `/api` e `/uploads` à API em `127.0.0.1:3333`. O banco e a API são necessários para carregar os dados. Para gerar os arquivos estáticos, execute `npm run build --prefix frontend`. Ao hospedar o build, configure também um proxy para esses caminhos; o proxy do Vite é apenas de desenvolvimento.

## Entregas da primeira versão

- Interface em português, responsiva, com estados de carregamento, erro e ausência de dados.
- Ocorrências públicas, paginação, filtros de município/status e busca por título/descrição no servidor antes da paginação.
- Mapa Leaflet/OpenStreetMap com pontos reais e coordenadas públicas aproximadas.
- Cadastro de cidadão, login, logout e restauração/renovação de sessão com cookie httpOnly. Access token mantido apenas em memória.
- Registro multipart com foto, município, bairro, endereço, coordenadas e publicação anônima; localização do navegador opcional.
- Ocorrências próprias, detalhes, histórico, confirmação e remoção da confirmação.
- Avaliação de reparo para cidadãos; a API valida vínculo, status e duplicidade.
- Notificações e marcação de todas como lidas.
- Painel para operador, moderador e administrador: indicadores, categorias, ranking e CSV.
- Atualização operacional de status com ações compatíveis com perfil/status e campos específicos de departamento, motivo, mensagem pública, agendamento e resolução. A API é a autoridade de permissões e transições.
- Fila de revisão de imagens para moderadores/administradores com decisões auditadas; fotos pendentes usam leitura autenticada.
- Filtros compartilhados entre mapa/lista e catálogo dinâmico.

## Limites e próximos passos

- Os seletores usam catálogos ativos do banco, incluindo municípios, bairros e categorias. O seed contém dois municípios; adicionar municípios reais exige cadastrá-los com dados geográficos apropriados.
- Imagens fictícias do seed apontam para `example.test`; a interface mostra uma ilustração substituta. Fotos enviadas pelo formulário usam o storage real.
- Tiles OpenStreetMap e fontes Google precisam de internet; existem fontes locais alternativas. Geolocalização requer permissão e contexto seguro (HTTPS ou localhost).
- Perfil/senha, departamentos e gestão ADMIN de usuários possuem telas dedicadas, com filtros e paginação na gestão. Edição de avaliações e filtros avançados do dashboard permanecem pendentes.
- Não há publicação externa. O [plano de continuidade](PLANO_CONTINUIDADE.md) cruza o repositório com os documentos de produto fornecidos. A cobertura do PRD original continua não verificada enquanto seu texto integral estiver ausente.

O frontend não altera o status histórico de aprovação da Fase 10 do backend.

## Verificação desta entrega

- Build Vite e lint aprovados.
- Chromium: consulta pública, detalhes/histórico, login de operador e cidadão, painel, CSV, sessão após recarga, notificações, logout e layout de 390 px sem rolagem horizontal.
- Formulário real: upload PNG, criação de ocorrência em revisão e exibição em registros próprios. Registro temporário excluído logicamente pela API administrativa ao final.
- Banco PostgreSQL/PostGIS real; sem substituir respostas da API por dados simulados no frontend.

## Referência visual fornecida

Referência: [Apresentação Tá na Rua — Canva](https://canva.link/lcohac30mbj98xn), 10 páginas. As páginas 3 e 4 apresentam os fluxos móveis; a página 5 apresenta a visão geral municipal. A apresentação é uma referência visual e de produto, não o PRD Técnico Consolidado v1.2.

A interface foi adaptada para azul/branco, identidade com marcador urbano, navegação inferior móvel, mapa/lista, formulário de registro, compartilhamento por link, painel azul-marinho, gráfico por categoria, mapa de concentração em células reais de 250 metros e tempo médio de resolução. O símbolo do aplicativo foi recriado em SVG; não foi extraído como arquivo de marca original do Canva.

Comentários, ranking/gamificação de cidadãos, benchmarking territorial, publicidade, análise visual de IA em tempo real e série temporal de chamados aparecem na apresentação, mas continuam dependendo de definições e/ou endpoints adicionais. Valores ilustrativos do Canva não são usados como indicadores reais do painel.

A continuidade deste frontend e o fluxo de mídia estão detalhados em [FASE11_VALIDACAO.md](FASE11_VALIDACAO.md).
