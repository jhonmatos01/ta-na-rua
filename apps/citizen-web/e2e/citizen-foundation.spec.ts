import { expect, test, type Page } from '@playwright/test';

import {
  createdOccurrenceFixture,
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
        meta: { requestId: 'e2e-confirmation-state' },
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

test('mantém o cabeçalho legível no celular', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/ocorrencias/${publicOccurrenceFixture.id}`);

  await expect(page.getByRole('link', { name: 'Abrir mapa público' })).toBeHidden();
  await expect(page.getByRole('link', { name: 'Status' })).toBeHidden();
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const headerItems = await page.locator('header').evaluate((header) => {
    const brand = header.querySelector('a[href="/"]')?.getBoundingClientRect();
    const navigation = header.querySelector('nav')?.getBoundingClientRect();
    return { brandRight: brand?.right ?? 0, navigationLeft: navigation?.left ?? 0 };
  });
  expect(headerItems.brandRight).toBeLessThanOrEqual(headerItems.navigationLeft);
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

test('registra uma ocorrência com foto, ponto revisado e prevenção de duplicidade', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/refresh', (route) =>
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
        meta: { requestId: 'e2e-session-request' },
      }),
    }),
  );
  await page.route(/\/api\/v1\/occurrences\/nearby(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { occurrences: [] },
        meta: { requestId: 'e2e-nearby', page: 1, limit: 5, total: 0, totalPages: 0 },
      }),
    }),
  );
  await page.route('**/api/v1/geocoding/reverse', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          address: {
            street: 'Rua das Flores',
            houseNumber: '123',
            streetAddress: 'Rua das Flores, 123',
            neighborhood: 'Pituba',
            city: 'Salvador',
            state: 'Bahia',
            postcode: '41830-000',
            countryCode: 'BR',
            formattedAddress: 'Rua das Flores, 123 · Pituba · Salvador · Bahia',
            provider: {
              name: 'OpenStreetMap',
              text: '© OpenStreetMap contributors',
              url: 'https://www.openstreetmap.org/copyright',
            },
          },
        },
        meta: { requestId: 'e2e-geocoding' },
      }),
    }),
  );
  let submissions = 0;
  await page.route(/\/api\/v1\/occurrences$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    submissions += 1;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { occurrence: createdOccurrenceFixture },
        meta: { requestId: 'e2e-created' },
      }),
    });
  });

  await page.goto('/nova-ocorrencia');
  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole('heading', { name: /mostre onde a cidade precisa/i })).toBeVisible();
  await page.getByLabel('Foto do problema').setInputFiles({
    name: 'buraco.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByLabel('Título do problema').fill('Buraco próximo à escola');
  await page.getByRole('button', { name: 'Continuar para localização' }).click();
  await page.getByRole('button', { name: 'Marcar manualmente' }).click();
  await expect(page.getByLabel('Mapa para corrigir a localização do problema')).toBeVisible();
  const locationCanvas = page
    .getByLabel('Mapa para corrigir a localização do problema')
    .locator('.maplibregl-canvas');
  await expect(locationCanvas).toBeVisible();
  await expect
    .poll(async () => locationCanvas.evaluate((canvas) => canvas.getBoundingClientRect().height))
    .toBeGreaterThan(250);
  await page.getByRole('button', { name: 'Buscar endereço deste ponto' }).click();
  await expect(page.getByLabel(/endereço ou referência/i)).toHaveValue('Rua das Flores, 123');
  await expect(page.getByLabel(/^Bairro/i)).toHaveValue('Pituba');
  await expect(page.getByRole('link', { name: /openstreetmap contributors/i })).toBeVisible();
  await page.getByRole('button', { name: 'Revisar registro' }).click();
  await expect(page.getByText(/nenhum problema público foi encontrado/i)).toBeVisible();
  await page.getByRole('button', { name: 'Enviar ocorrência' }).click();

  await expect(page.getByText('TNR-2026-000099')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(submissions).toBe(1);
});

test('confirma e desfaz a confirmação comunitária com contador sincronizado', async ({ page }) => {
  let confirmed = false;
  let refreshCalls = 0;
  await page.route('**/api/v1/auth/refresh', (route) => {
    refreshCalls += 1;
    return route.fulfill({
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
        meta: { requestId: 'e2e-community-session' },
      }),
    });
  });
  await page.route(/\/api\/v1\/occurrences\/[^/]+\/confirmations\/count$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          occurrenceId: publicOccurrenceFixture.id,
          confirmationCount: confirmed ? 19 : 18,
          priorityScore: confirmed ? 83.1 : 82.4,
          confirmedByMe: confirmed,
        },
        meta: { requestId: 'e2e-community-state' },
      }),
    }),
  );
  await page.route(/\/api\/v1\/occurrences\/[^/]+\/confirmations$/, (route) => {
    confirmed = true;
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          confirmation: {
            id: '41000000-0000-4000-8000-000000000001',
            occurrenceId: publicOccurrenceFixture.id,
            directlyAffected: false,
            problemWorsened: false,
            comment: null,
            createdAt: '2026-07-22T12:00:00.000Z',
            updatedAt: '2026-07-22T12:00:00.000Z',
          },
          occurrence: { confirmationCount: 19, priorityScore: 83.1 },
        },
        meta: { requestId: 'e2e-community-created' },
      }),
    });
  });
  await page.route(/\/api\/v1\/occurrences\/[^/]+\/confirmations\/me$/, (route) => {
    confirmed = false;
    return route.fulfill({ status: 204, body: '' });
  });

  await page.goto(`/ocorrencias/${publicOccurrenceFixture.id}`);
  await expectNoHorizontalOverflow(page);
  const community = page.getByRole('region', { name: /você também viu este problema/i });
  await expect(community.getByRole('button', { name: 'Eu também vi' })).toBeVisible();
  expect(refreshCalls).toBe(1);

  await page.reload();
  await expect(community.getByRole('button', { name: 'Eu também vi' })).toBeVisible();
  expect(refreshCalls).toBe(2);

  await community.getByRole('button', { name: 'Eu também vi' }).click();
  await expect(
    community.getByRole('button', { name: /desfazer minha confirmação/i }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(community.getByText('19')).toBeVisible();

  await community.getByRole('button', { name: /desfazer minha confirmação/i }).click();
  await expect(community.getByRole('button', { name: 'Eu também vi' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(community.getByText('18')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
