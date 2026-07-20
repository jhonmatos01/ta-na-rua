# Validacao da Fase 2 - Autenticacao e usuarios

Use somente dados ficticios. O roteiro pressupoe Docker/PostGIS na porta configurada no `.env`, API em `http://localhost:3333` e Adminer em `http://localhost:8080`.

## 1. Preparacao

```bash
npm run docker:up
npm run db:migrate
npm run db:seed
npm run db:validate
npm run dev
```

O seed pode ser repetido. O validador deve confirmar 7 usuarios, 4 perfis, 2 municipios, 1 usuario bloqueado, 1 refresh revogado e todos os hashes de senha iniciados por `$argon2id$`.

## 2. Login e JWT

```bash
curl -i -c cookies.txt -H "content-type: application/json" \
  -d '{"email":"ana.cidada@example.test","password":"Cidada123!Fase2"}' \
  http://localhost:3333/api/v1/auth/login
```

Confirme HTTP 200, `accessToken`, `expiresIn: 900`, usuario sem `passwordHash` e cookie `ta_na_rua_refresh` com `HttpOnly`, `SameSite=Lax` e `Path=/api/v1/auth`. O refresh nunca aparece no JSON.

Copie o access token para o Swagger em `/docs`, clique em **Authorize** e execute `GET /api/v1/auth/me` e `GET /api/v1/users/me`.

## 3. Rotacao e reutilizacao

Preserve o cookie original antes do primeiro refresh. Execute `POST /api/v1/auth/refresh`: deve retornar 200 e substituir o cookie. Reenvie deliberadamente o cookie antigo: deve retornar 401 `REFRESH_TOKEN_REUSE_DETECTED`. Em seguida, até o JWT recém-emitido deve retornar 401 `SESSION_REVOKED`, pois toda a família foi revogada.

## 4. Perfis, municipio e bloqueio

- Login de `bia.bloqueada@example.test` deve retornar 403 `USER_BLOCKED`.
- Um JWT de `CITIZEN` em `/api/v1/admin/users` deve retornar 403 `FORBIDDEN`.
- Um JWT de `ADMIN` deve listar usuarios e permitir alterar status ou perfil.
- Alterar status para `BLOCKED` ou alterar o perfil revoga imediatamente as sessoes do usuario-alvo.
- Os testes automatizados verificam isolamento municipal: `CITIZEN` e `CITY_OPERATOR` ficam no proprio municipio; `MODERATOR` e `ADMIN` podem atravessar municipios.

## 5. Senha, logout e exclusao

- `POST /api/v1/auth/logout` retorna 204 e invalida a sessao.
- `POST /api/v1/auth/change-password` exige senha atual, retorna 204, revoga todas as sessoes e exige novo login.
- `DELETE /api/v1/users/me` retorna 204, grava `status = 'DELETED'` e `deleted_at`, e revoga todas as sessoes.

## 6. Adminer sem expor credenciais

Execute apenas consultas de formato e contagem. Nunca selecione o hash inteiro.

```sql
SELECT role, status, COUNT(*)
FROM users
GROUP BY role, status
ORDER BY role, status;

SELECT
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE password_hash LIKE '$argon2id$%') AS argon2id_users,
  COUNT(DISTINCT municipality_id) AS municipalities,
  COUNT(*) FILTER (WHERE status = 'BLOCKED') AS blocked_users
FROM users;

SELECT
  COUNT(*) AS total_refresh,
  COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) AS revoked_refresh,
  COUNT(*) FILTER (WHERE token_hash ~ '^[0-9a-f]{64}$') AS sha256_hashes
FROM refresh_tokens;

SELECT action, COUNT(*)
FROM audit_logs
WHERE action IN (
  'USER_PASSWORD_CHANGED',
  'USER_PROFILE_UPDATED',
  'USER_DELETED',
  'ADMIN_USER_STATUS_CHANGED',
  'ADMIN_USER_ROLE_CHANGED'
)
GROUP BY action
ORDER BY action;
```

Resultado minimo do seed: 7 hashes Argon2id, 4 perfis, 2 municipios, 1 bloqueado e 1 refresh revogado com 64 caracteres hexadecimais. As consultas evitam revelar senhas, tokens ou hashes completos.

## 7. Qualidade

```bash
npm run format:check
npm run lint
npm test
npm run test:coverage
npm run build
npm run validate
npm audit --omit=dev
```

Todos os comandos devem terminar com codigo zero. Os testes cobrem 401, 403, 409, 422, token invalido/expirado, bloqueio, perfis, outro municipio, proprietario, logout, troca de senha, revogacao e reutilizacao de refresh.
