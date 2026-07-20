# Roteiro de validacao - Fase 1

Este roteiro verifica o schema definitivo, as migrations, o seed idempotente e o PostGIS da Fase 1.

## Validacao automatizada

Com Docker/PostGIS ativo, execute:

```bash
npm run db:migrate
npm run db:seed
npm run db:seed
npm run db:validate
npm run test:coverage
npm run validate
```

O segundo seed deve terminar sem erro e sem aumentar as quantidades dos dados ficticios.

## Conferencia no Adminer

Abra http://localhost:8080 ou http://127.0.0.1:8080 e use:

| Campo         | Valor do ambiente   |
| ------------- | ------------------- |
| Sistema       | PostgreSQL          |
| Servidor      | `postgres`          |
| Usuario       | `POSTGRES_USER`     |
| Senha         | `POSTGRES_PASSWORD` |
| Base de dados | `POSTGRES_DB`       |

### Tabelas

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Resultado esperado: 18 tabelas da aplicacao, alem das views e tabelas mantidas pelo PostGIS.

### Enums

```sql
SELECT typname, enumlabel
FROM pg_type
JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
WHERE pg_namespace.nspname = 'public'
ORDER BY typname, enumsortorder;
```

Resultado esperado: 11 tipos enumerados.

### Constraints e chaves estrangeiras

```sql
SELECT conrelid::regclass AS tabela, conname, contype
FROM pg_constraint
JOIN pg_namespace ON pg_namespace.oid = pg_constraint.connamespace
WHERE pg_namespace.nspname = 'public'
ORDER BY tabela, conname;
```

Os tipos mais importantes sao `c` para checks, `f` para chaves estrangeiras, `p` para chaves primarias e `u` para unicidade.

### PostGIS e indices geograficos

```sql
SELECT PostGIS_Version();

SELECT table_name, column_name, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (
    ('occurrences', 'location'),
    ('occurrence_reports', 'location')
  );

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'occurrences_location_gist_idx',
    'occurrence_reports_location_gist_idx'
  );
```

As duas colunas devem usar `geography` e os dois indices devem usar `gist`.

### Seed

```sql
SELECT 'municipalities' AS entidade, COUNT(*) FROM municipalities
UNION ALL SELECT 'neighborhoods', COUNT(*) FROM neighborhoods
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'departments', COUNT(*) FROM departments
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'occurrences', COUNT(*) FROM occurrences
UNION ALL SELECT 'occurrence_reports', COUNT(*) FROM occurrence_reports
UNION ALL SELECT 'occurrence_images', COUNT(*) FROM occurrence_images
UNION ALL SELECT 'occurrence_confirmations', COUNT(*) FROM occurrence_confirmations
UNION ALL SELECT 'occurrence_status_history', COUNT(*) FROM occurrence_status_history
UNION ALL SELECT 'repair_evaluations', COUNT(*) FROM repair_evaluations
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications;
```

Minimos esperados: 2 municipios, 3 bairros, 11 categorias, 3 departamentos, 3 usuarios preparados, 2 ocorrencias, 2 reports, 2 metadados de imagem, 1 confirmacao, 3 historicos, 1 avaliacao e 2 notificacoes.

Confirme que `refresh_tokens` esta vazia e que nenhum usuario possui uma credencial funcional:

```sql
SELECT COUNT(*) FROM refresh_tokens;
SELECT email, role, status, password_hash FROM users ORDER BY email;
```

O hash preparado deve ser `PHASE_2_AUTH_NOT_CONFIGURED`. Ele nao representa uma senha valida.

## Casos de erro das constraints

Execute cada caso dentro de uma transacao e reverta ao final:

```sql
BEGIN;
UPDATE occurrences
SET confirmation_count = -1
WHERE protocol = 'TNR-2026-000001';
ROLLBACK;
```

Resultado esperado: violacao de `occurrences_confirmation_count_chk`.

```sql
BEGIN;
UPDATE repair_evaluations SET rating = 6;
ROLLBACK;
```

Resultado esperado: violacao de `repair_evaluations_rating_chk`.

## Resultado esperado

- migration registrada no schema `drizzle`;
- 18 tabelas e 11 enums;
- 53 ou mais constraints de dominio e relacionamento;
- PostGIS ativo e duas colunas `geography`;
- dois indices GiST;
- seed repetivel sem duplicacoes;
- nenhuma sessao ou senha funcional antes da Fase 2;
- lint, testes, cobertura, build e `validate` aprovados.
