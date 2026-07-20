import type { PoolClient, QueryResultRow } from 'pg';

import { pool } from '../../database/pool.js';
import type { RequestContext } from '../auth/auth.types.js';
import type { CreateDepartmentInput, UpdateDepartmentInput } from './departments.schemas.js';
import {
  DepartmentConflictError,
  type DepartmentListFilters,
  type DepartmentListResult,
  type DepartmentRecord,
  type DepartmentsRepository,
} from './departments.types.js';

interface DepartmentRow extends QueryResultRow {
  id: string;
  municipality_id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
  total_count?: string;
}

const departmentColumns = `
  id, municipality_id, name, description, active, created_at, updated_at
`;

function mapDepartment(row: DepartmentRow): DepartmentRecord {
  return {
    id: row.id,
    municipalityId: row.municipality_id,
    name: row.name,
    description: row.description,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

async function insertAudit(
  client: PoolClient,
  actorId: string,
  action: string,
  entityId: string,
  previousData: Record<string, unknown> | null,
  newData: Record<string, unknown>,
  context: RequestContext,
  now: Date,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (
       user_id, action, entity_type, entity_id, previous_data, new_data,
       ip_address, user_agent, created_at
     ) VALUES ($1, $2, 'department', $3, $4::jsonb, $5::jsonb, $6, $7, $8)`,
    [
      actorId,
      action,
      entityId,
      previousData === null ? null : JSON.stringify(previousData),
      JSON.stringify(newData),
      context.ipAddress,
      context.userAgent,
      now,
    ],
  );
}

export class PostgresDepartmentsRepository implements DepartmentsRepository {
  public async isMunicipalityActive(municipalityId: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT 1 FROM municipalities WHERE id = $1 AND active = TRUE',
      [municipalityId],
    );
    return result.rowCount === 1;
  }

  public async list(filters: DepartmentListFilters): Promise<DepartmentListResult> {
    const values: unknown[] = [];
    const conditions: string[] = [];
    if (filters.municipalityId !== undefined) {
      values.push(filters.municipalityId);
      conditions.push(`municipality_id = $${values.length}`);
    }
    if (filters.active !== undefined) {
      values.push(filters.active);
      conditions.push(`active = $${values.length}`);
    }
    const where = conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`;
    const resultValues = [...values, filters.limit, filters.offset];
    const [result, countResult] = await Promise.all([
      pool.query<DepartmentRow>(
        `SELECT ${departmentColumns}
         FROM departments
        ${where}
        ORDER BY name ASC, id ASC
        LIMIT $${resultValues.length - 1} OFFSET $${resultValues.length}`,
        resultValues,
      ),
      pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM departments ${where}`,
        values,
      ),
    ]);
    return {
      items: result.rows.map(mapDepartment),
      total: Number(countResult.rows[0]?.total ?? 0),
    };
  }

  public async findById(departmentId: string): Promise<DepartmentRecord | null> {
    const result = await pool.query<DepartmentRow>(
      `SELECT ${departmentColumns} FROM departments WHERE id = $1`,
      [departmentId],
    );
    return result.rows[0] === undefined ? null : mapDepartment(result.rows[0]);
  }

  public async create(
    actorId: string,
    input: CreateDepartmentInput,
    context: RequestContext,
    now: Date,
  ): Promise<DepartmentRecord> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<DepartmentRow>(
        `INSERT INTO departments (
           municipality_id, name, description, active, created_at, updated_at
         ) VALUES ($1, $2, $3, TRUE, $4, $4)
         RETURNING ${departmentColumns}`,
        [input.municipalityId, input.name, input.description, now],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('Falha ao criar departamento.');
      await insertAudit(
        client,
        actorId,
        'DEPARTMENT_CREATED',
        row.id,
        null,
        { municipalityId: row.municipality_id, name: row.name, active: row.active },
        context,
        now,
      );
      await client.query('COMMIT');
      return mapDepartment(row);
    } catch (error) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(error)) throw new DepartmentConflictError();
      throw error;
    } finally {
      client.release();
    }
  }

  public async update(
    actorId: string,
    departmentId: string,
    input: UpdateDepartmentInput,
    context: RequestContext,
    now: Date,
  ): Promise<DepartmentRecord | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const currentResult = await client.query<DepartmentRow>(
        `SELECT ${departmentColumns} FROM departments WHERE id = $1 FOR UPDATE`,
        [departmentId],
      );
      const current = currentResult.rows[0];
      if (current === undefined) {
        await client.query('ROLLBACK');
        return null;
      }
      const result = await client.query<DepartmentRow>(
        `UPDATE departments
            SET name = $2, description = $3, updated_at = $4
          WHERE id = $1
          RETURNING ${departmentColumns}`,
        [
          departmentId,
          input.name ?? current.name,
          input.description === undefined ? current.description : input.description,
          now,
        ],
      );
      const updated = result.rows[0];
      if (updated === undefined) throw new Error('Falha ao atualizar departamento.');
      await insertAudit(
        client,
        actorId,
        'DEPARTMENT_UPDATED',
        departmentId,
        { name: current.name, description: current.description },
        { name: updated.name, description: updated.description },
        context,
        now,
      );
      await client.query('COMMIT');
      return mapDepartment(updated);
    } catch (error) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(error)) throw new DepartmentConflictError();
      throw error;
    } finally {
      client.release();
    }
  }

  public async setActive(
    actorId: string,
    departmentId: string,
    active: boolean,
    context: RequestContext,
    now: Date,
  ): Promise<DepartmentRecord | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const currentResult = await client.query<DepartmentRow>(
        `SELECT ${departmentColumns} FROM departments WHERE id = $1 FOR UPDATE`,
        [departmentId],
      );
      const current = currentResult.rows[0];
      if (current === undefined) {
        await client.query('ROLLBACK');
        return null;
      }
      const result = await client.query<DepartmentRow>(
        `UPDATE departments SET active = $2, updated_at = $3 WHERE id = $1
         RETURNING ${departmentColumns}`,
        [departmentId, active, now],
      );
      const updated = result.rows[0];
      if (updated === undefined) throw new Error('Falha ao alterar departamento.');
      await insertAudit(
        client,
        actorId,
        active ? 'DEPARTMENT_ACTIVATED' : 'DEPARTMENT_DEACTIVATED',
        departmentId,
        { active: current.active },
        { active: updated.active },
        context,
        now,
      );
      await client.query('COMMIT');
      return mapDepartment(updated);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
