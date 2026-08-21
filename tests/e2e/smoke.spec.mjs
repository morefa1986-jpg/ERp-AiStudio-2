import { expect, test } from '@playwright/test';

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

test('fresh browser session shows the server-backed authentication gate', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('input[type="text"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  await page.locator('input[type="text"]').nth(0).fill('owner');
  await page.locator('input[type="text"]').nth(1).fill('E2E Owner');
  await page.locator('input[type="email"]').fill('e2e-owner@example.test');
  await page.locator('input[type="password"]').nth(0).fill('e2e-owner-password-2026');
  await page.locator('input[type="password"]').nth(1).fill('e2e-owner-password-2026');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
});
