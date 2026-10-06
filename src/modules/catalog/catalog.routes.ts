import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../database/pool.js';
import { createSuccessResponse } from '../../shared/http/responses.js';
import { parseInput } from '../../shared/validation/parse.js';
import { AppError } from '../../shared/errors/app-error.js';

export interface CatalogRepository {
  municipalities(): Promise<unknown[]>;
  categories(): Promise<unknown[]>;
  neighborhoods(municipalityId: string): Promise<unknown[] | null>;
}
export class PostgresCatalogRepository implements CatalogRepository {
  public async municipalities(): Promise<unknown[]> {
    return (
      await pool.query<Record<string, unknown>>(
        'SELECT id, name, state, ibge_code AS "ibgeCode", latitude::float8 AS latitude, longitude::float8 AS longitude FROM municipalities WHERE active = true ORDER BY state, name, id',
      )
    ).rows;
  }
  public async categories(): Promise<unknown[]> {
    return (
      await pool.query<Record<string, unknown>>(
        'SELECT id, code, name, slug, description, icon FROM categories WHERE active = true ORDER BY name, id',
      )
    ).rows;
  }
  public async neighborhoods(municipalityId: string): Promise<unknown[] | null> {
    const municipality = await pool.query<Record<string, unknown>>(
      'SELECT id FROM municipalities WHERE id = $1 AND active = true',
      [municipalityId],
    );
    if (municipality.rows.length === 0) return null;
    return (
      await pool.query<Record<string, unknown>>(
        'SELECT id, name, slug, municipality_id AS "municipalityId" FROM neighborhoods WHERE municipality_id = $1 AND active = true ORDER BY name, id',
        [municipalityId],
      )
    ).rows;
  }
}
export function createCatalogRouter(
  repository: CatalogRepository = new PostgresCatalogRepository(),
): Router {
  const router = Router();
  router.get('/municipalities', async (request, response, next) => {
    try {
      parseInput(z.strictObject({}), request.query);
      response.json(
        createSuccessResponse(request, { municipalities: await repository.municipalities() }),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get('/categories', async (request, response, next) => {
    try {
      parseInput(z.strictObject({}), request.query);
      response.json(createSuccessResponse(request, { categories: await repository.categories() }));
    } catch (error) {
      next(error);
    }
  });
  router.get('/neighborhoods', async (request, response, next) => {
    try {
      const { municipalityId } = parseInput(
        z.strictObject({ municipalityId: z.uuid() }),
        request.query,
      );
      const neighborhoods = await repository.neighborhoods(municipalityId);
      if (neighborhoods === null)
        throw new AppError(404, 'MUNICIPALITY_NOT_FOUND', 'Municipio ativo nao encontrado.');
      response.json(createSuccessResponse(request, { neighborhoods }));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
