import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  mapPointFixtures,
  publicOccurrenceFixture,
  secondPublicOccurrenceFixture,
  timelineFixtures,
} from '../src/tests/occurrence-fixtures';

async function mockPublicApi(page: Page): Promise<void> {
  await page.route('https://tiles.openfreemap.org/styles/liberty', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: 8, sources: {}, layers: [] }),
    }),
  );
  await page.route('**/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { status: 'ok', timestamp: '2026-07-22T20:00:00.000Z' },
        meta: { requestId: 'a11y-health' },
      }),
    }),
  );
  await page.route('**/health/database', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { status: 'connected', postgisVersion: '3.5.0', responseTimeMs: 8 },
        meta: { requestId: 'a11y-database' },
      }),
    }),
  );
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'REFRESH_TOKEN_REQUIRED', message: 'Sessão não encontrada.' },
        meta: { requestId: 'a11y-refresh' },
      }),
    }),
  );
  await page.route(/\/api\/v1\/occurrences\/map(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { points: mapPointFixtures },
        meta: { requestId: 'a11y-map' },
      }),
    }),
  );
  await page.route(/\/api\/v1\/occurrences(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { occurrences: [publicOccurrenceFixture, secondPublicOccurrenceFixture] },
        meta: {
          requestId: 'a11y-occurrences',
          page: 1,
          limit: 100,
          total: 2,
          totalPages: 1,
        },
      }),
    }),
  );
  await page.route(/\/api\/v1\/occurrences\/[^/]+\/timeline$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { timeline: timelineFixtures },
        meta: { requestId: 'a11y-timeline' },
      }),
    }),
  );
  await page.route(/\/api\/v1\/occurrences\/[^/]+\/confirmations\/count$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          occurrenceId: publicOccurrenceFixture.id,
          confirmationCount: 18,
          priorityScore: 82.4,
        },
        meta: { requestId: 'a11y-confirmations' },
      }),
    }),
  );
  await page.route(/\/api\/v1\/occurrences\/(?!map$)[^/?]+$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { occurrence: publicOccurrenceFixture },
        meta: { requestId: 'a11y-occurrence' },
      }),
    }),
  );
  await page.route('**/uploads/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
}

function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
): string {
  return violations
    .map(
      (violation) =>
        `${violation.id}: ${violation.help}\n${violation.nodes
          .map((node) => `  ${node.target.join(' ')} — ${node.failureSummary ?? 'sem resumo'}`)
          .join('\n')}`,
    )
    .join('\n\n');
}

const auditedRoutes = [
  { name: 'início', path: '/' },
  { name: 'status', path: '/status' },
  { name: 'entrada', path: '/entrar' },
  { name: 'cadastro', path: '/criar-conta' },
  { name: 'mapa público', path: '/mapa' },
  { name: 'detalhe público', path: `/ocorrencias/${publicOccurrenceFixture.id}` },
  { name: 'página não encontrada', path: '/rota-inexistente' },
] as const;

test.beforeEach(async ({ page }) => mockPublicApi(page));

for (const route of auditedRoutes) {
  test(`${route.name} não possui violações WCAG automáticas`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.locator('main')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
}
