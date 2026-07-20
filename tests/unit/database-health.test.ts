import { describe, expect, it, vi } from 'vitest';

import { checkDatabaseHealth, type DatabaseQuery } from '../../src/database/health.js';

describe('checkDatabaseHealth', () => {
  it('confirma a versao do PostGIS', async () => {
    const execute = vi.fn<DatabaseQuery>().mockResolvedValue({
      rows: [{ postgisVersion: '3.5.2' }],
    });

    const health = await checkDatabaseHealth(execute);

    expect(execute).toHaveBeenCalledWith('SELECT PostGIS_Version()::text AS "postgisVersion"');
    expect(health).toEqual({
      status: 'connected',
      postgisVersion: '3.5.2',
      responseTimeMs: expect.any(Number) as number,
    });
  });

  it('rejeita uma resposta sem versao do PostGIS', async () => {
    const execute = vi.fn<DatabaseQuery>().mockResolvedValue({ rows: [] });

    await expect(checkDatabaseHealth(execute)).rejects.toThrow(/PostGIS/u);
  });
});
