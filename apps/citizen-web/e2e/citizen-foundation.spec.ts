import { expect, test, type Page } from '@playwright/test';

async function mockHealth(page: Page): Promise<void> {
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
}

test.beforeEach(async ({ page }) => mockHealth(page));

test('navega da página inicial ao status dos serviços', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /sua cidade.*mais próxima/i })).toBeVisible();
  await expect(page.getByText('Disponível')).toBeVisible();

  await page.getByRole('link', { name: /ver status dos serviços/i }).click();
  await expect(page).toHaveURL(/\/status$/);
  await expect(page.getByText('API respondendo normalmente.')).toBeVisible();
  await expect(page.getByText('Camada de dados respondendo normalmente.')).toBeVisible();
});

test('exibe a rota 404 com retorno seguro', async ({ page }) => {
  await page.goto('/rota-inexistente');
  await expect(page.getByRole('heading', { name: /página não encontrada/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /voltar ao início/i })).toBeVisible();
});
