import { expect, test, type Page } from '@playwright/test';

import {
  mapPointFixtures,
  publicOccurrenceFixture,
  secondPublicOccurrenceFixture,
  timelineFixtures,
} from '../src/tests/occurrence-fixtures';

async function mockHealth(page: Page): Promise<void> {
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
        data: { status: 'ok', timestamp: '2026-07-20T21:00:00.000Z' },
        meta: { requestId: 'e2e-api-request' },
      }),
    }),
  );
  await page.route('**/health/database', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { status: 'connected', postgisVersion: '3.6.1', responseTimeMs: 7 },
        meta: { requestId: 'e2e-database-request' },
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
        meta: { requestId: 'e2e-refresh-request' },
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
          requestId: 'e2e-occurrences-request',
          page: 1,
          limit: 100,
          total: 2,
          totalPages: 1,
        },
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
        meta: { requestId: 'e2e-map-request' },
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
        meta: { requestId: 'e2e-timeline-request' },
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
        meta: { requestId: 'e2e-occurrence-request' },
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

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

const e2eUser = {
  id: '50000000-0000-4000-8000-000000000001',
  name: 'Ana Cidadã',
  email: 'ana.e2e@example.test',
  phone: null,
  role: 'CITIZEN',
  municipalityId: '10000000-0000-4000-8000-000000000001',
  neighborhood: 'Pituba',
  avatarUrl: null,
  status: 'ACTIVE',
  emailVerifiedAt: null,
  lastLoginAt: '2026-07-20T21:00:00.000Z',
  createdAt: '2026-07-20T20:00:00.000Z',
  updatedAt: '2026-07-20T21:00:00.000Z',
  deletedAt: null,
};

test.beforeEach(async ({ page }) => mockHealth(page));

test('navega da página inicial ao status dos serviços', async ({ page }) => {
  await page.goto('/');
  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole('heading', { name: /sua cidade.*mais próxima/i })).toBeVisible();
  await expect(page.getByText('Disponível')).toBeVisible();

  await page.getByRole('link', { name: 'Detalhes' }).click();
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveURL(/\/status$/);
  await expect(page.getByText('API respondendo normalmente.')).toBeVisible();
  await expect(page.getByText('Camada de dados respondendo normalmente.')).toBeVisible();
});

test('exibe a rota 404 com retorno seguro', async ({ page }) => {
  await page.goto('/rota-inexistente');
  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole('heading', { name: /página não encontrada/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /voltar ao início/i })).toBeVisible();
});

test('cadastra, entra, acessa o perfil e sai da conta', async ({ page }) => {
  await page.route('**/api/v1/auth/register', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { user: e2eUser },
        meta: { requestId: 'e2e-register-request' },
      }),
    }),
  );
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          accessToken: 'e2e-access-token',
          tokenType: 'Bearer',
          expiresIn: 900,
          user: e2eUser,
        },
        meta: { requestId: 'e2e-login-request' },
      }),
    }),
  );
  await page.route('**/api/v1/auth/logout', (route) => route.fulfill({ status: 204 }));

  await page.goto('/criar-conta');
  await expectNoHorizontalOverflow(page);
  await page.getByLabel(/^Nome completo/i).fill('Ana Cidadã');
  await page.getByLabel(/^E-mail/i).fill('ana.e2e@example.test');
  await page.getByLabel(/^Senha/i).fill('SenhaForte123!');
  await page.getByLabel(/confirmar senha/i).fill('SenhaForte123!');
  await page.getByRole('button', { name: /criar minha conta/i }).click();

  await expect(page).toHaveURL(/\/entrar$/);
  await expectNoHorizontalOverflow(page);
  await expect(page.getByText(/conta criada com sucesso/i)).toBeVisible();
  await page.getByLabel(/^Senha/i).fill('SenhaForte123!');
  await page.getByRole('button', { name: /^entrar$/i }).click();

  await expect(page).toHaveURL(/\/perfil$/);
  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole('heading', { name: 'Ana Cidadã' })).toBeVisible();
  await page.getByRole('button', { name: /sair da conta/i }).click();
  await expect(page).toHaveURL(/\/entrar$/);
});

test('explora o mapa público, busca e abre os detalhes', async ({ page }) => {
  await page.goto('/mapa');
  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByRole('heading', { name: /o que está acontecendo na cidade/i }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Buraco na Rua das Flores')).toBeVisible();
  await expect(page.getByLabel('Mapa interativo de ocorrências públicas')).toBeVisible();

  await page.getByLabel('Buscar').fill('poste');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page).toHaveURL(/busca=poste/);
  await expect(page.getByText('Poste apagado na avenida')).toBeVisible();
  await expect(page.getByText('Buraco na Rua das Flores')).toHaveCount(0);

  await page.getByRole('button', { name: 'Limpar' }).click();
  await page.getByRole('link', { name: /Buraco na Rua das Flores/ }).click();
  await expect(page).toHaveURL(/\/ocorrencias\/30000000-0000-4000-8000-000000000001$/);
  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Buraco na Rua das Flores' }),
  ).toBeVisible();
  await expect(page.getByText('Equipe responsável iniciou o atendimento.')).toBeVisible();
  await expect(page.getByText(/não publica autoria, coordenadas exatas/i)).toBeVisible();
});
