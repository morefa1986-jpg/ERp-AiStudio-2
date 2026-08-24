import { expect, test as setup } from '@playwright/test';

const CREDENTIALS = {
  username: 'owner',
  password: 'e2e-owner-password-2026',
};

setup('fresh browser session bootstraps the first server-backed administrator', async ({ page }) => {
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

  const status = await page.request.get('/api/auth/status');
  expect(status.ok()).toBeTruthy();
  await expect(status.json()).resolves.toMatchObject({ needsBootstrap: false });
});
