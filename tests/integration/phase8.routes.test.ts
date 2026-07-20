import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/modules/auth/auth.security.js';
import type { UserRole } from '../../src/modules/auth/auth.types.js';
import type { DashboardService } from '../../src/modules/dashboard/dashboard.types.js';
import type { RequestPrincipal } from '../../src/modules/occurrences/occurrences.types.js';
import { InMemoryIdentityRepository, makeUser } from '../helpers/in-memory-identity-repository.js';

class FakeDashboardService implements DashboardService {
  public lastPrincipal: RequestPrincipal | null = null;
  public lastQuery: unknown = null;

  public summary(principal: RequestPrincipal, query: unknown): Promise<unknown> {
    return this.result(principal, query, { summary: { totalOccurrences: 0 } });
  }
  public byCategory(principal: RequestPrincipal, query: unknown): Promise<unknown> {
    return this.result(principal, query, { categories: [] });
  }
  public byNeighborhood(principal: RequestPrincipal, query: unknown): Promise<unknown> {
    return this.result(principal, query, { neighborhoods: [] });
  }
  public byStatus(principal: RequestPrincipal, query: unknown): Promise<unknown> {
    return this.result(principal, query, { statuses: [] });
  }
  public priorityRanking(principal: RequestPrincipal, query: unknown): Promise<unknown> {
    return this.result(principal, query, { occurrences: [] });
  }
  public resolutionTime(principal: RequestPrincipal, query: unknown): Promise<unknown> {
    return this.result(principal, query, { resolutionTime: { resolvedOccurrences: 0 } });
  }
  public heatmap(principal: RequestPrincipal, query: unknown): Promise<unknown> {
    return this.result(principal, query, { cells: [] });
  }
  public export(principal: RequestPrincipal, query: unknown) {
    this.lastPrincipal = principal;
    this.lastQuery = query;
    return Promise.resolve({
      filename: 'dashboard-2026-07-19.csv',
      content: '\uFEFFprotocol,title\r\n',
      rowCount: 0,
      truncated: false,
      limit: 10_000,
    });
  }

  private result(principal: RequestPrincipal, query: unknown, value: unknown): Promise<unknown> {
    this.lastPrincipal = principal;
    this.lastQuery = query;
    return Promise.resolve(value);
  }
}

async function authenticatedApp(role: UserRole) {
  const identityRepository = new InMemoryIdentityRepository();
  const user = makeUser({ role, municipalityId: randomUUID(), status: 'ACTIVE', deletedAt: null });
  const sessionId = randomUUID();
  identityRepository.addUser(user);
  await identityRepository.createRefreshToken({
    sessionId,
    userId: user.id,
    tokenHash: randomUUID(),
    expiresAt: new Date(Date.now() + 60_000),
    ipAddress: null,
    userAgent: null,
  });
  const service = new FakeDashboardService();
  return {
    app: createApp({ identityRepository, dashboardService: service }),
    service,
    token: await signAccessToken(user, sessionId),
  };
}

describe('rotas HTTP da Fase 8', () => {
  it('exige autenticacao e perfil operacional', async () => {
    await request(createApp({ dashboardService: new FakeDashboardService() }))
      .get('/api/v1/dashboard/summary')
      .expect(401);
    const citizen = await authenticatedApp('CITIZEN');
    await request(citizen.app)
      .get('/api/v1/dashboard/summary')
      .set('authorization', `Bearer ${citizen.token}`)
      .expect(403);
  });

  it('disponibiliza os sete indicadores para operador autorizado', async () => {
    const operator = await authenticatedApp('CITY_OPERATOR');
    const paths = [
      '/summary',
      '/by-category',
      '/by-neighborhood',
      '/by-status',
      '/priority-ranking',
      '/resolution-time',
      '/heatmap',
    ];
    for (const path of paths) {
      await request(operator.app)
        .get(`/api/v1/dashboard${path}`)
        .set('authorization', `Bearer ${operator.token}`)
        .expect(200)
        .expect((response) => expect((response.body as { success: boolean }).success).toBe(true));
    }
  });

  it('valida filtros, periodo e limite do ranking', async () => {
    const admin = await authenticatedApp('ADMIN');
    const categoryId = randomUUID();
    await request(admin.app)
      .get(
        `/api/v1/dashboard/priority-ranking?categoryId=${categoryId}&status=PUBLISHED&limit=10&startDate=2026-07-01T00:00:00.000Z&endDate=2026-07-31T23:59:59.000Z`,
      )
      .set('authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(admin.service.lastQuery).toMatchObject({ categoryId, status: 'PUBLISHED', limit: 10 });
    await request(admin.app)
      .get(
        '/api/v1/dashboard/summary?startDate=2026-07-31T00:00:00.000Z&endDate=2026-07-01T00:00:00.000Z',
      )
      .set('authorization', `Bearer ${admin.token}`)
      .expect(422);
    await request(admin.app)
      .get('/api/v1/dashboard/priority-ranking?limit=101')
      .set('authorization', `Bearer ${admin.token}`)
      .expect(422);
  });

  it('exporta CSV com metadados de limite', async () => {
    const moderator = await authenticatedApp('MODERATOR');
    await request(moderator.app)
      .get('/api/v1/dashboard/export')
      .set('authorization', `Bearer ${moderator.token}`)
      .expect('content-type', /text\/csv/u)
      .expect('content-disposition', 'attachment; filename="dashboard-2026-07-19.csv"')
      .expect('x-export-row-count', '0')
      .expect('x-export-truncated', 'false')
      .expect(200);
  });
});
