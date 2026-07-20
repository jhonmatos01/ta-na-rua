import { beforeEach, describe, expect, it, vi } from 'vitest';

const { connectMock, queryMock, releaseMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  queryMock: vi.fn(),
  releaseMock: vi.fn(),
}));

vi.mock('../../src/database/pool.js', () => ({
  pool: {
    connect: connectMock,
    query: vi.fn(),
  },
}));

import { PostgresOutboxRepository } from '../../src/modules/outbox/outbox.repository.js';

describe('PostgresOutboxRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectMock.mockResolvedValue({ query: queryMock, release: releaseMock });
  });

  it('qualifica as colunas retornadas no UPDATE ... FROM do claim', async () => {
    const now = new Date('2026-07-20T04:45:00.000Z');
    const leaseUntil = new Date('2026-07-20T04:46:00.000Z');
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '78000000-0000-4000-8000-000000000001',
            event_type: 'TELEGRAM_REPORT_RECEIVED',
            entity_type: 'webhook_event',
            entity_id: '77000000-0000-4000-8000-000000000001',
            payload: { fixture: true },
            status: 'PROCESSING',
            attempts: 1,
            available_at: leaseUntil,
            processed_at: null,
            last_error: null,
            created_at: now,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const events = await new PostgresOutboxRepository().claimBatch(10, 5, now, leaseUntil);
    const claimSql = String(queryMock.mock.calls[2]?.[0]);

    expect(claimSql).toContain('RETURNING');
    expect(claimSql).toContain('event.id, event.event_type');
    expect(claimSql).toContain('event.last_error, event.created_at');
    expect(events).toEqual([
      expect.objectContaining({
        id: '78000000-0000-4000-8000-000000000001',
        status: 'PROCESSING',
        attempts: 1,
      }),
    ]);
    expect(releaseMock).toHaveBeenCalledOnce();
  });
});
