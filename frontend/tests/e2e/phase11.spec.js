import { randomUUID } from 'node:crypto';
import { test, expect, request as apiRequest } from '@playwright/test';

async function browserLogin(page, email, password) {
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.locator('[name=email]').fill(email);
  await page.locator('[name=password]').fill(password);
  await page.locator('#auth-form button[type=submit]').click();
  await page.locator('#logout').waitFor();
}

test('catalogos, busca no servidor e filtros preservados no mapa', async ({ page, baseURL }) => {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'De olho na rua.' })).toBeVisible();
  const cities = await page.request.get(baseURL + '/api/v1/catalog/municipalities');
  const { data } = await cities.json();
  await expect(page.locator('#city option')).toHaveCount(data.municipalities.length + 1);
  await page.locator('#city').selectOption(data.municipalities[0].id);
  await expect(page.locator('#neighborhood')).toBeEnabled();
  await page.locator('#search').fill('nenhuma_ocorrencia_' + randomUUID());
  const response = page.waitForResponse(
    (r) => r.url().includes('/api/v1/occurrences?') && r.url().includes('q='),
  );
  await page.locator('#search').press('Tab');
  await response;
  await expect(page.getByRole('heading', { name: 'Nenhuma ocorrência encontrada' })).toBeVisible();
  await page.locator('.view-toggle').click();
  await expect(page.getByRole('heading', { name: 'Mapa da cidade' })).toBeVisible();
  await expect(page.locator('#city')).toHaveValue(data.municipalities[0].id);
  await expect(page.locator('#search')).toHaveValue(/nenhuma_ocorrencia_/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.mobile-nav')).toBeVisible();
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
  expect(failures).toEqual([]);
});

test('foto privada, decisao pela fila e publicacao independente', async ({ page, baseURL }) => {
  test.skip(
    !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname),
    'Escritas de fixtures permitidas somente em ambiente local.',
  );
  const context = await apiRequest.newContext({ baseURL });
  let occurrenceId;
  const sessions = [];
  async function login(email, password) {
    const response = await context.post('/api/v1/auth/login', { data: { email, password } });
    expect(response.status()).toBe(200);
    const body = await response.json();
    const session = {
      token: body.data.accessToken,
      cookie: response.headers()['set-cookie'].split(';')[0],
    };
    sessions.push(session);
    return session;
  }
  let admin;
  try {
    const citizen = await login('ana.cidada@example.test', 'Cidada123!Fase2');
    admin = await login('adriano.admin@example.test', 'Admin123!Fase2');
    const title = 'Revisão E2E ' + randomUUID().slice(0, 8);
    await page.goto('/');
    await browserLogin(page, 'ana.cidada@example.test', 'Cidada123!Fase2');
    await page.getByRole('button', { name: 'Registrar ocorrência' }).click();
    await page.locator('[name=title]').fill(title);
    await page.locator('[name=latitude]').fill('-12.9941');
    await page.locator('[name=longitude]').fill('-38.459');
    await page
      .locator('#create-form [name=municipalityId]')
      .selectOption('10000000-0000-4000-8000-000000000001');
    await expect(page.locator('[name=neighborhoodId]')).toBeEnabled();
    await page.locator('[name=image]').setInputFiles({
      name: 'review.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2hioAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    const creation = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/occurrences') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Enviar ocorrência' }).click();
    const createdResponse = await creation;
    expect(createdResponse.status()).toBe(201);
    const occurrence = (await createdResponse.json()).data.occurrence;
    occurrenceId = occurrence.id;
    const image = occurrence.images[0];
    expect((await context.get(image.url)).status()).toBe(404);
    expect(
      (
        await context.get(image.url, { headers: { authorization: `Bearer ${citizen.token}` } })
      ).status(),
    ).toBe(200);
    await page.getByRole('heading', { name: title }).click();
    await expect(page.locator('.detail-image').first()).toHaveAttribute('src', /^blob:/);
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await browserLogin(page, 'marina.moderadora@example.test', 'Moderador123!Fase2');
    await page.getByRole('link', { name: 'Revisão de imagens' }).click();
    const item = page
      .locator('.review-item')
      .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    await expect(item.locator('.review-photo')).toHaveAttribute('src', /^blob:/);
    await item.locator('[name=status]').selectOption('APPROVED');
    await item.locator('[name=reason]').fill('Foto do teste revisada sem pessoas identificáveis.');
    await item.getByRole('button', { name: 'Registrar decisão' }).click();
    await expect(page.locator('#notice')).toContainText('Decisão de imagem registrada');
    expect((await context.get(image.url)).status()).toBe(404);
    const publication = await context.patch(`/api/v1/occurrences/${occurrenceId}/status`, {
      headers: { authorization: `Bearer ${admin.token}` },
      data: { status: 'PUBLISHED', reason: 'Teste isolado de publicação.' },
    });
    expect(publication.status()).toBe(200);
    expect((await context.get(image.url)).status()).toBe(200);
    await page.getByRole('link', { name: 'Explorar ocorrências' }).click();
    await page.locator('#search').fill(title);
    await page.locator('#search').press('Tab');
    await page.getByRole('heading', { name: title, exact: true }).click();
    await page.getByText('Atualizar status', { exact: true }).click();
    await expect(page.locator('#status-form [name=status]')).toHaveValue('FORWARDED');
    await expect(page.locator('#status-form [name=departmentId]')).toBeVisible();
    await expect(page.locator('#status-form [name=expectedResolutionAt]')).toBeVisible();
    await expect(page.locator('#status-form [name=resolutionDescription]')).toBeHidden();
    await page
      .locator('#status-form [name=departmentId]')
      .selectOption('40000000-0000-4000-8000-000000000001');
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
    await page
      .locator('#status-form [name=expectedResolutionAt]')
      .fill(tomorrow.toISOString().slice(0, 16));
    const forwarded = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/occurrences/${occurrenceId}/status`) && r.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Salvar status' }).click();
    expect((await forwarded).status()).toBe(200);
    await expect(page.locator('#dialog')).not.toBeVisible();
    for (const status of ['UNDER_ANALYSIS', 'IN_PROGRESS', 'RESOLVED']) {
      const response = await context.patch(`/api/v1/occurrences/${occurrenceId}/status`, {
        headers: { authorization: `Bearer ${admin.token}` },
        data: {
          status,
          ...(status === 'RESOLVED' ? { resolutionDescription: 'Reparo de teste concluído.' } : {}),
        },
      });
      expect(response.status()).toBe(200);
    }
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await browserLogin(page, 'ana.cidada@example.test', 'Cidada123!Fase2');
    await page.goto('/#occurrence/' + occurrenceId);
    await page.getByText('Avaliar o reparo', { exact: true }).click();
    await page.locator('#evaluation-form [name=rating]').selectOption('4');
    await page.locator('#evaluation-form [name=serviceQuality]').selectOption('3');
    await page.locator('#evaluation-form [name=comment]').fill('Atendimento testado');
    await page.getByRole('button', { name: 'Enviar avaliação', exact: true }).click();
    await expect(page.locator('.my-evaluation')).toContainText('Nota 4/5');
    await expect(page.locator('.evaluation-summary')).toContainText('1 avaliações');
    await page.getByText('Editar minha avaliação', { exact: true }).click();
    await expect(page.locator('#evaluation-form [name=rating]')).toHaveValue('4');
    await page.locator('#evaluation-form [name=rating]').selectOption('5');
    await page.locator('#evaluation-form [name=comment]').fill('Reparo confirmado');
    await page.getByRole('button', { name: 'Salvar avaliação', exact: true }).click();
    await expect(page.locator('.my-evaluation')).toContainText('Nota 5/5');
    const publicSummary = await context.get(
      `/api/v1/occurrences/${occurrenceId}/evaluations/summary`,
    );
    expect((await publicSummary.json()).data.summary).toMatchObject({ total: 1, averageRating: 5 });
    const reopened = await context.patch(`/api/v1/occurrences/${occurrenceId}/status`, {
      headers: { authorization: `Bearer ${admin.token}` },
      data: { status: 'IN_PROGRESS', reason: 'Reabertura para validar bloqueio de edição.' },
    });
    expect(reopened.status()).toBe(200);
    await page.reload();
    await expect(page.locator('.my-evaluation')).toContainText('A edição está indisponível');
    await expect(page.locator('#evaluation-form')).toHaveCount(0);
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
  } finally {
    if (occurrenceId && admin) {
      const response = await context.delete(`/api/v1/occurrences/${occurrenceId}`, {
        headers: { authorization: `Bearer ${admin.token}` },
      });
      expect(response.status()).toBe(204);
    }
    for (const session of sessions)
      await context.post('/api/v1/auth/logout', { headers: { cookie: session.cookie } });
    await context.dispose();
  }
});

test('perfil persiste e troca de senha encerra a sessao', async ({ page, baseURL }) => {
  test.skip(!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname));
  const email = `perfil-${randomUUID()}@example.test`;
  const password = 'PerfilInicial123!';
  const newPassword = 'PerfilAlterado456!';
  const registered = await page.request.post('/api/v1/auth/register', {
    data: {
      name: 'Perfil temporário',
      email,
      password,
      municipalityId: '10000000-0000-4000-8000-000000000001',
    },
  });
  expect(registered.status()).toBe(201);
  try {
    await page.goto('/');
    await browserLogin(page, email, password);
    await page.locator('.user-name').click();
    await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible();
    await page.locator('#profile-form [name=name]').fill('Perfil atualizado');
    await page.locator('#profile-form [name=neighborhood]').fill('Pituba');
    await page.getByRole('button', { name: 'Salvar perfil' }).click();
    await expect(page.locator('#notice')).toHaveText('Perfil atualizado.');
    await page.reload();
    await expect(page.locator('#profile-form [name=name]')).toHaveValue('Perfil atualizado');
    await page.locator('#password-form [name=currentPassword]').fill(password);
    await page.locator('#password-form [name=newPassword]').fill(newPassword);
    await page.locator('#password-form [name=confirmation]').fill('SenhaDiferente123!');
    await page.getByRole('button', { name: 'Alterar senha', exact: true }).click();
    await expect(page.locator('#password-form .form-error')).toHaveText(
      'As novas senhas precisam ser iguais.',
    );
    await page.locator('#password-form [name=confirmation]').fill(newPassword);
    await page.getByRole('button', { name: 'Alterar senha', exact: true }).click();
    await expect(page.locator('#logout')).toHaveCount(0);
    const oldLogin = await page.request.post('/api/v1/auth/login', { data: { email, password } });
    expect(oldLogin.status()).toBe(401);
    await browserLogin(page, email, newPassword);
    await expect(page.locator('.user-name')).toHaveText('Perfil atualizado');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#mobile-profile').click();
    await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible();
    expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
  } finally {
    const response = await page.request.post('/api/v1/auth/login', {
      data: { email, password: newPassword },
    });
    const fallback = response.ok()
      ? response
      : await page.request.post('/api/v1/auth/login', { data: { email, password } });
    if (fallback.ok()) {
      const session = await fallback.json();
      const deleted = await page.request.delete('/api/v1/users/me', {
        headers: { Authorization: `Bearer ${session.data.accessToken}` },
      });
      expect(deleted.status()).toBe(204);
    }
  }
});

test('gestao de departamentos e acesso de usuario temporario', async ({ page, baseURL }) => {
  test.skip(!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname));
  const context = await apiRequest.newContext({ baseURL });
  const email = `gestao-${randomUUID()}@example.test`;
  const password = 'GestaoTemporaria123!';
  const name = 'Gestão temporária ' + randomUUID().slice(0, 8);
  const departmentName = 'Departamento E2E ' + randomUUID().slice(0, 8);
  const registered = await context.post('/api/v1/auth/register', {
    data: { name, email, password, municipalityId: '10000000-0000-4000-8000-000000000001' },
  });
  expect(registered.status()).toBe(201);
  let departmentId;
  let userId;
  let adminToken;
  try {
    const adminLogin = await context.post('/api/v1/auth/login', {
      data: { email: 'adriano.admin@example.test', password: 'Admin123!Fase2' },
    });
    adminToken = (await adminLogin.json()).data.accessToken;
    const before = await context.post('/api/v1/auth/login', { data: { email, password } });
    const session = (await before.json()).data;
    userId = session.user.id;
    await page.goto('/');
    await browserLogin(page, 'adriano.admin@example.test', 'Admin123!Fase2');
    await page.locator('[data-view=departments]').click();
    await expect(page.getByRole('heading', { name: 'Departamentos', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Novo departamento' }).click();
    await page.locator('#department-form [name=name]').fill(departmentName);
    const createdPromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/departments') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Salvar departamento' }).click();
    departmentId = (await (await createdPromise).json()).data.department.id;
    const row = page.locator('tr').filter({ hasText: departmentName });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Editar' }).click();
    await page.locator('#department-form [name=description]').fill('Equipe de teste');
    await page.locator('#department-form [name=active]').selectOption('false');
    await page.getByRole('button', { name: 'Salvar departamento' }).click();
    await expect(row).toContainText('Inativo');
    await row.getByRole('button', { name: 'Editar' }).click();
    await page.locator('#department-form [name=active]').selectOption('true');
    await page.getByRole('button', { name: 'Salvar departamento' }).click();
    await expect(row).toContainText('Ativo');
    await page.locator('[data-view=users]').click();
    const userRow = page.locator('tr').filter({ hasText: email });
    await expect(userRow).toBeVisible();
    await userRow.getByRole('button', { name: 'Gerenciar acesso' }).click();
    await page.locator('#access-form [name=value]').selectOption('BLOCKED');
    await page.getByRole('button', { name: 'Confirmar alteração' }).click();
    await expect(userRow).toContainText('Bloqueado');
    const revoked = await context.get('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(revoked.status()).toBe(403);
    await userRow.getByRole('button', { name: 'Gerenciar acesso' }).click();
    await page.locator('#access-form [name=value]').selectOption('ACTIVE');
    await page.getByRole('button', { name: 'Confirmar alteração' }).click();
    await expect(userRow).toContainText('Ativo');
    const oldSession = await context.get('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(oldSession.status()).toBe(401);
    await userRow.getByRole('button', { name: 'Gerenciar acesso' }).click();
    await page.locator('#access-form [name=field]').selectOption('role');
    await page.locator('#access-form [name=value]').selectOption('MODERATOR');
    await page.getByRole('button', { name: 'Confirmar alteração' }).click();
    await expect(userRow).toContainText('Moderador');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#mobile-profile').click();
    await page.locator('#content').getByRole('link', { name: 'Departamentos' }).click();
    await expect(page.getByRole('heading', { name: 'Departamentos', exact: true })).toBeVisible();
  } finally {
    if (adminToken) {
      const headers = { Authorization: `Bearer ${adminToken}` };
      if (departmentId)
        expect(
          (await context.delete(`/api/v1/departments/${departmentId}`, { headers })).status(),
        ).toBe(204);
      if (userId)
        await context.patch(`/api/v1/admin/users/${userId}/status`, {
          headers,
          data: { status: 'ACTIVE' },
        });
    }
    const login = await context.post('/api/v1/auth/login', { data: { email, password } });
    if (login.ok()) {
      const { data } = await login.json();
      expect(
        (
          await context.delete('/api/v1/users/me', {
            headers: { Authorization: `Bearer ${data.accessToken}` },
          })
        ).status(),
      ).toBe(204);
    }
    await context.dispose();
  }
});
