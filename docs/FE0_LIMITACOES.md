# FE‑0 — limitações conhecidas

A FE‑0 é uma fundação técnica e visual. As limitações abaixo são intencionais e delimitam a entrega atual.

- não há cadastro, login, recuperação de senha ou sessão cidadã;
- não há registro, listagem, detalhe, mapa, busca ou acompanhamento de ocorrências;
- não há captura de câmera, upload, geolocalização ou notificações push;
- não há interface de operador, moderador ou administrador;
- o manifesto prepara a evolução para PWA, mas ainda não há service worker, cache offline ou fluxo de instalação validado;
- os únicos endpoints consumidos são `/health` e `/health/database`;
- a configuração `VITE_ENABLE_DEVTOOLS` está validada e reservada, sem ferramenta visual ativada nesta fase;
- o desenvolvimento local usa `http://localhost:5173`, conforme o CORS atual do back-end; outra origem precisa ser configurada explicitamente na API;
- a URL da API é definida no build e ainda não existe configuração remota em tempo de execução;
- acessibilidade recebeu cobertura estrutural e manual inicial, mas ainda não passou por auditoria externa com pessoas usuárias ou tecnologia assistiva dedicada;
- os E2E usam respostas controladas para serem determinísticos; a integração real dos endpoints de saúde foi validada separadamente no navegador.

Funcionalidades futuras devem entrar em fases próprias, com contratos confirmados, critérios de aceite, privacidade e testes antes da implementação.
