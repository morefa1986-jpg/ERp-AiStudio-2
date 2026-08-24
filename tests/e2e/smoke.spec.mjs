import { expect, test } from '@playwright/test';

const CREDENTIALS = {
  username: 'owner',
  password: 'e2e-owner-password-2026',
};

async function loginApi(request) {
  const response = await request.post('/api/auth/login', {
    data: { ...CREDENTIALS, language: 'fa' },
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.success).toBe(true);
  expect(payload.token).toMatch(/^fathi_sec_/);
  return payload.token;
}

async function loginBrowser(page) {
  await page.addInitScript(() => sessionStorage.setItem('fathi_aqua_lang', 'fa'));
  await page.goto('/');
  await page.locator('input[type="text"]').first().fill(CREDENTIALS.username);
  await page.locator('input[type="password"]').first().fill(CREDENTIALS.password);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('health endpoint reports local SQLite and localhost binding', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({
    status: 'ok',
    database: 'sqlite',
    host: '127.0.0.1',
    lanMode: false,
  });
});

test('fresh browser session bootstraps the first server-backed administrator', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('fathi_aqua_lang', 'fa'));
  await page.goto('/');
  await expect(page.locator('input[type="text"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  await page.locator('input[type="text"]').nth(0).fill(CREDENTIALS.username);
  await expect(page.locator('input[type="text"]').nth(1)).toBeVisible();
  await page.locator('input[type="text"]').nth(1).fill('E2E Owner');
  await page.locator('input[type="email"]').fill('e2e-owner@example.test');
  await page.locator('input[type="password"]').nth(0).fill(CREDENTIALS.password);
  await page.locator('input[type="password"]').nth(1).fill(CREDENTIALS.password);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
});

test('logout invalidates the session and the same user can log in again', async ({ request }) => {
  const firstToken = await loginApi(request);
  const authenticated = await request.get('/api/auth/session', {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  expect(authenticated.ok()).toBeTruthy();

  const logout = await request.post('/api/auth/logout', {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  expect(logout.ok()).toBeTruthy();

  const invalidated = await request.get('/api/auth/session', {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  expect(invalidated.status()).toBe(401);

  const secondToken = await loginApi(request);
  expect(secondToken).not.toBe(firstToken);
});

test('online water parameter gateway is protected by ERP authentication', async ({ request }) => {
  const anonymous = await request.get('/api/dahir/status');
  expect(anonymous.status()).toBe(401);

  const token = await loginApi(request);
  const authorized = await request.get('/api/dahir/status', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(authorized.ok()).toBeTruthy();
  await expect(authorized.json()).resolves.toMatchObject({
    success: true,
    gateway: {
      configured: false,
      authMode: 'none',
      maxAgeMinutes: 15,
    },
  });
});

test('feeding screen states that feeding is manual and sends no automatic equipment command', async ({ page }) => {
  await loginBrowser(page);
  await page.getByRole('button', { name: /موتور جیره و تغذیه/ }).click();
  await expect(page.getByText('حالت خوراک‌دهی: دستی', { exact: true })).toBeVisible();
  await expect(page.getByText('بدون فرمان خودکار به تجهیزات', { exact: true })).toBeVisible();
});

test('water quality screen exposes the neutral online water-parameters feature name', async ({ page }) => {
  await loginBrowser(page);
  await page.getByRole('button', { name: /کیفیت آب و سنسورهای IoT/ }).click();
  await expect(page.getByText('بررسی آنلاین پارامترهای آب · تصفیه‌خانه', { exact: true })).toBeVisible();
});
