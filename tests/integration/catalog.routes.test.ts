/* eslint-disable @typescript-eslint/unbound-method -- Repository methods here are Vitest mocks without this. */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { CatalogRepository } from '../../src/modules/catalog/catalog.routes.js';

const municipalityId = randomUUID();
function setup() {
  const repository: CatalogRepository = {
    municipalities: vi.fn(() => Promise.resolve([{ id: municipalityId, name: 'Municipio ativo' }])),
    categories: vi.fn(() => Promise.resolve([{ id: randomUUID(), name: 'Iluminacao' }])),
    neighborhoods: vi.fn((id) =>
      Promise.resolve(
        id === municipalityId ? [{ id: randomUUID(), municipalityId, name: 'Bairro ativo' }] : null,
      ),
    ),
  };
  return { app: createApp({ catalogRepository: repository }), repository };
}
describe('catalogos publicos', () => {
  it('consulta municipios e categorias sem login', async () => {
    const { app } = setup();
    const cities = await request(app).get('/api/v1/catalog/municipalities').expect(200);
    expect(cities.body).toMatchObject({
      success: true,
      data: { municipalities: [{ id: municipalityId }] },
    });
    await request(app).get('/api/v1/catalog/categories').expect(200);
  });
  it('exige municipio valido e nao entrega bairros de municipio inativo ou inexistente', async () => {
    const { app, repository } = setup();
    await request(app).get('/api/v1/catalog/neighborhoods').expect(422);
    await request(app).get('/api/v1/catalog/neighborhoods?municipalityId=invalid').expect(422);
    expect(repository.neighborhoods).not.toHaveBeenCalled();
    await request(app)
      .get(`/api/v1/catalog/neighborhoods?municipalityId=${randomUUID()}`)
      .expect(404);
    const result = await request(app)
      .get(`/api/v1/catalog/neighborhoods?municipalityId=${municipalityId}`)
      .expect(200);
    expect(result.body).toMatchObject({ data: { neighborhoods: [{ municipalityId }] } });
  });
});
