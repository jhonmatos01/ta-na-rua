# Deploy da API

O repositorio entrega uma imagem multi-stage e um compose de producao. Nenhum deploy externo e executado sem destino e credenciais especificos.

## Pre-requisitos

- Docker Engine ou Docker Desktop com Compose v2;
- dominio HTTPS e proxy reverso;
- PostgreSQL/PostGIS persistente;
- bucket S3 compativel;
- endpoints de IA e n8n;
- cofre ou arquivo de ambiente fora do repositorio.

## Preparar ambiente

1. Copie `.env.production.example` para `.env.production`.
2. Substitua todos os `CHANGE_ME` por valores aleatorios e exclusivos.
3. Em `DATABASE_URL`, use o host `postgres` quando utilizar o compose fornecido.
4. Defina `CORS_ORIGIN` com a origem HTTPS exata do aplicativo.
5. Ajuste `TRUST_PROXY_HOPS` ao numero de proxies confiaveis entre o cliente e a API.

O arquivo `.env.production` e ignorado pelo Git. A aplicacao recusa placeholders, CORS HTTP, storage local e integracoes obrigatorias ausentes em `NODE_ENV=production`.

## Validar e construir

```bash
npm ci
npm run validate
npm run test:coverage
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
docker compose --env-file .env.production -f docker-compose.production.yml build api migrate
```

## Migration e subida

Execute a migration como tarefa unica:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml --profile operations run --rm migrate
```

Depois inicie banco e API:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d postgres api
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

O seed e bloqueado em producao e nunca deve integrar o deploy. Dados ficticios sao instalados somente no ambiente local.

## Verificacao

```bash
curl -fsS https://api.example.com/health
curl -fsS https://api.example.com/health/database
curl -fsS https://api.example.com/docs/openapi.json
```

Confirme tambem logs sem credenciais, health do container, acesso ao S3, callback n8n e um fluxo de login controlado.

## Atualizacao e rollback

1. Gere uma imagem imutavel com tag de versao ou SHA.
2. Faça backup e teste restauracao antes de migration destrutiva.
3. Execute migrations compativeis com a versao anterior sempre que possivel.
4. Suba a nova API e aguarde health.
5. Em falha de aplicacao, reverta a tag da imagem. Nao reverta migration com `git checkout` nem edite migrations executadas.
6. Correcoes de schema exigem nova migration de avancar.

## Hardening de infraestrutura

- exponha somente a porta HTTPS do proxy; nao publique PostgreSQL ou Adminer;
- use usuario e banco com privilegios minimos depois das migrations;
- mantenha `no-new-privileges`, `cap_drop: ALL` e filesystem somente leitura;
- habilite limite compartilhado/WAF quando houver multiplas replicas;
- centralize logs por stdout e alerte health, 5xx, 429 e outbox `FAILED`;
- configure backup criptografado, retencao e restauracao testada.
