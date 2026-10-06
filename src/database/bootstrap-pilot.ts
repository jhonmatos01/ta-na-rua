import { z } from 'zod';
import { env } from '../config/env.js';
import { hashPassword } from '../modules/auth/auth.security.js';
import { pool, closeDatabase } from './pool.js';

const schema = z.object({
  BOOTSTRAP_ADMIN_EMAIL: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(2).max(150),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(env.PASSWORD_MIN_LENGTH).max(128),
  PILOT_CITY_NAME: z.string().trim().min(2).max(150),
  PILOT_CITY_STATE: z.string().regex(/^[A-Z]{2}$/u),
  PILOT_CITY_IBGE: z.string().regex(/^\d{7}$/u),
  PILOT_CITY_LATITUDE: z.string().min(1).transform(Number).pipe(z.number().min(-90).max(90)),
  PILOT_CITY_LONGITUDE: z.string().min(1).transform(Number).pipe(z.number().min(-180).max(180)),
});
const categories = [
  ['POTHOLE', 'Buraco na via', 'buraco-na-via'],
  ['PUBLIC_LIGHTING', 'Iluminação pública', 'iluminacao-publica'],
  ['WATER_LEAK', 'Vazamento de água', 'vazamento-de-agua'],
  ['SEWAGE', 'Esgoto', 'esgoto'],
  ['GARBAGE', 'Lixo acumulado', 'lixo-acumulado'],
  ['SIDEWALK_DAMAGE', 'Calçada danificada', 'calcada-danificada'],
  ['FLOODING', 'Alagamento', 'alagamento'],
  ['FALLEN_TREE', 'Árvore caída', 'arvore-caida'],
  ['TRAFFIC_SIGN', 'Sinalização danificada', 'sinalizacao-danificada'],
  ['TRAFFIC_LIGHT', 'Semáforo com defeito', 'semaforo-com-defeito'],
  ['OTHER', 'Outros', 'outros'],
];
async function bootstrap(): Promise<void> {
  if (env.NODE_ENV !== 'production' || env.DEPLOYMENT_PROFILE !== 'pilot')
    throw new Error('Bootstrap permitido somente em production com perfil pilot.');
  const parsed = schema.safeParse(process.env);
  if (!parsed.success)
    throw new Error(
      'Confira as variaveis de bootstrap: ' +
        parsed.error.issues.map((issue) => issue.path.join('.')).join(', '),
    );
  const input = parsed.data;
  const passwordHash = await hashPassword(input.BOOTSTRAP_ADMIN_PASSWORD);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('tanarua-bootstrap-pilot'))");
    // Avoid mixing fresh deployment with fixtures or an existing user base.
    await client.query('LOCK TABLE users, municipalities, categories IN EXCLUSIVE MODE');
    const existing = await client.query<{ present: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM users) OR EXISTS(SELECT 1 FROM municipalities) OR EXISTS(SELECT 1 FROM categories) AS present',
    );
    if (existing.rows[0]?.present) {
      const initialized = await client.query<{ present: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM audit_logs a JOIN users u ON u.id = a.user_id WHERE a.action = 'PILOT_BOOTSTRAPPED' AND u.email = $1 AND u.role = 'ADMIN' AND u.status = 'ACTIVE' AND u.deleted_at IS NULL) AS present",
        [input.BOOTSTRAP_ADMIN_EMAIL],
      );
      if (initialized.rows[0]?.present) {
        await client.query('ROLLBACK');
        console.log('Piloto ja inicializado; nenhum dado ou senha foi alterado.');
        return;
      }
      throw new Error(
        'Bootstrap recusado: banco ja possui usuarios ou catalogos. Nenhum dado foi alterado.',
      );
    }
    const city = await client.query<{ id: string }>(
      'INSERT INTO municipalities (name, state, ibge_code, latitude, longitude) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [
        input.PILOT_CITY_NAME,
        input.PILOT_CITY_STATE,
        input.PILOT_CITY_IBGE,
        input.PILOT_CITY_LATITUDE,
        input.PILOT_CITY_LONGITUDE,
      ],
    );
    const municipalityId = city.rows[0]!.id;
    for (const [code, name, slug] of categories)
      await client.query(
        'INSERT INTO categories (code, name, slug, description) VALUES ($1,$2,$3,$4)',
        [code, name, slug, 'Categoria de infraestrutura urbana para o piloto.'],
      );
    await client.query(
      "INSERT INTO departments (municipality_id, name) VALUES ($1, 'Atendimento urbano')",
      [municipalityId],
    );
    const admin = await client.query<{ id: string }>(
      "INSERT INTO users (name, email, password_hash, role, status, municipality_id) VALUES ($1,$2,$3,'ADMIN','ACTIVE',$4) RETURNING id",
      [input.BOOTSTRAP_ADMIN_NAME, input.BOOTSTRAP_ADMIN_EMAIL, passwordHash, municipalityId],
    );
    await client.query(
      "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data) VALUES ($1,'PILOT_BOOTSTRAPPED','user',$1,$2::jsonb)",
      [admin.rows[0]!.id, JSON.stringify({ municipalityId, categoryCount: categories.length })],
    );
    await client.query('COMMIT');
    console.log(
      'Piloto inicializado: municipio, categorias, departamento e administrador. Nenhuma conta de demonstracao foi copiada. Remova as variaveis BOOTSTRAP_ADMIN_* do provedor.',
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
try {
  await bootstrap();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha no bootstrap.');
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
