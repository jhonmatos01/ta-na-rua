# Relatorio de seguranca

Data de referencia: 20 de julho de 2026. Escopo: API, banco, uploads, integracoes, containers e artefatos do MVP.

## Resultado da revisao

| Area                     | Controle implementado                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Senhas                   | Argon2id; hash nunca retornado nem registrado                                          |
| Sessoes                  | JWT curto, refresh opaco em cookie `httpOnly`, hash SHA-256, rotacao e revogacao       |
| Autorizacao              | perfil, municipio, proprietario, estado e usuario ativo verificados no servidor        |
| CORS e proxy             | origem unica validada; HTTPS obrigatorio em producao; saltos de proxy configuraveis    |
| Headers                  | Helmet, CSP no Swagger, `x-powered-by` desativado e escape de JSON                     |
| Rate limit               | limite global por origem e camada adicional por provedor/origem para webhooks          |
| Entrada                  | Zod estrito, limites de corpo, paginacao e codigos padronizados                        |
| SQL e PostGIS            | parametros posicionais, constraints, transacoes e indices; sem concatenacao de entrada |
| Upload                   | multipart limitado, MIME real, JPEG/PNG/WebP, UUID aleatorio e limpeza de orfaos       |
| Logs                     | Pino com request ID e redacao de senha, token, cookie, segredos e assinatura           |
| Webhooks                 | HMAC do corpo bruto, timestamp, comparacao constante, hash e idempotencia              |
| Outbox                   | mesma transacao, lease, tentativas limitadas, backoff e erro sanitizado                |
| Privacidade e LGPD       | minimizacao, anonimato, coordenada publica aproximada, exclusao logica e isolamento    |
| Container                | usuario `node`, filesystem somente leitura, `cap_drop: ALL` e `no-new-privileges`      |
| Configuracao de producao | rejeita segredo padrao, placeholder, CORS sem HTTPS e storage diferente de S3          |

## Correcao incorporada na Fase 10

A API possuia rate limit apenas nos webhooks e confiava sempre em um proxy. A fase adicionou limite global configuravel em `/api`, headers `RateLimit-*`, HTTP 429 padronizado e `TRUST_PROXY_HOPS=0` por padrao. Isso evita confiar em `X-Forwarded-For` quando a API esta exposta diretamente.

## Dependencias e codigo

- `npm audit --omit=dev` terminou com zero vulnerabilidades de producao;
- a auditoria completa encontrou quatro alertas moderados somente na cadeia de desenvolvimento `drizzle-kit` -> `@esbuild-kit` -> `esbuild`; o `npm audit fix --force` proporia uma alteracao incompativel e nao foi aplicado;
- o Bruno CLI e executado de forma efemera e nao permanece em `package.json`;
- `TODO`, `FIXME`, funcoes vazias e marcadores de implementacao ausente nao foram encontrados em `src`;
- a busca por chaves privadas, tokens JWT persistidos e prefixos comuns de credenciais nao encontrou segredo versionado;
- `.env` e variantes reais permanecem ignorados; apenas exemplos sem credenciais sao versionados.

## Riscos residuais aceitos

- o rate limit global e local ao processo; multiplas replicas exigem Redis, gateway ou WAF compartilhado;
- nao ha revogacao instantanea de access JWT ja emitido fora da verificacao de sessao no banco;
- antivirus e CDR para imagens nao fazem parte do MVP; o sistema restringe tipo e tamanho;
- rotacao automatica de segredos e gerenciada pelo provedor de deploy, nao pela API;
- protecao DDoS, TLS, WAF, backup e observabilidade centralizada dependem da infraestrutura escolhida;
- Adminer e dados de demonstracao sao somente locais e nao integram o compose de producao.

## Checklist antes de producao

1. Substituir todos os valores `CHANGE_ME` em arquivo fora do repositorio ou cofre.
2. Usar TLS no proxy e `CORS_ORIGIN` HTTPS exato.
3. Ajustar `TRUST_PROXY_HOPS` ao numero real de proxies confiaveis.
4. Restringir acesso ao PostgreSQL, S3, IA e n8n por rede e identidade.
5. Executar migration como tarefa unica antes de iniciar a nova versao.
6. Habilitar backup, restauracao testada, logs centralizados e alertas de outbox.
7. Manter Adminer e seed desabilitados em producao.
8. Executar `npm run validate`, `npm run test:coverage` e auditoria de dependencias.
