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

function customer(id, suffix) {
  return {
    id,
    name: `E2E Customer ${suffix}`,
    companyName: `E2E Company ${suffix}`,
    category: 'Local Distributor',
    phone: '+1000000000',
    email: `e2e-${suffix.toLowerCase()}@example.test`,
    country: 'Test',
    city: 'Test City',
    address: '',
    currency: 'IRR',
    status: 'Lead',
    createdAt: new Date().toISOString(),
    totalOrdersCount: 0,
    totalSpent: 0,
    outstandingBalance: 0,
    notes: 'E2E',
  };
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

test('two clients changing independent rows from the same base are merged without lost update', async ({ page, request }) => {
  await loginBrowser(page);
  const base = await page.evaluate(async () => {
    const response = await fetch('/api/state', { headers: { Authorization: `Bearer ${sessionStorage.getItem('fathi_aqua_session_token')}` } });
    return response.json();
  });
  expect(base.success).toBe(true);
  expect(base.state?.data).toBeTruthy();

  const remoteId = `cust_remote_${Date.now()}`;
  const localId = `cust_local_${Date.now()}`;
  const remoteState = structuredClone(base.state.data);
  remoteState.customers = [customer(remoteId, 'Remote'), ...(remoteState.customers || [])];
  const remoteToken = await loginApi(request);
  const remoteWrite = await request.put('/api/state', {
    headers: { Authorization: `Bearer ${remoteToken}` },
    data: {
      state: remoteState,
      version: base.state.version,
      operation: { module: 'crm', action: 'create', entity: 'Customer', entityId: remoteId },
    },
  });
  expect(remoteWrite.ok()).toBeTruthy();

  const localResult = await page.evaluate(async ({ baseState, baseVersion, localCustomer }) => {
    const candidate = structuredClone(baseState);
    candidate.customers = [localCustomer, ...(candidate.customers || [])];
    const response = await fetch('/api/state', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionStorage.getItem('fathi_aqua_session_token')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: candidate, version: baseVersion, operation: { module: 'crm', action: 'create', entity: 'Customer', entityId: localCustomer.id } }),
    });
    return { status: response.status, payload: await response.json() };
  }, { baseState: base.state.data, baseVersion: base.state.version, localCustomer: customer(localId, 'Local') });

  expect(localResult.status).toBe(200);
  expect(localResult.payload.success).toBe(true);

  const finalState = await request.get('/api/state', { headers: { Authorization: `Bearer ${remoteToken}` } });
  const finalPayload = await finalState.json();
  const ids = finalPayload.state.data.customers.map((row) => row.id);
  expect(ids).toContain(remoteId);
  expect(ids).toContain(localId);
});

test('an offline state write survives reload and is replayed from the durable outbox', async ({ page, request }) => {
  await loginBrowser(page);
  const base = await page.evaluate(async () => {
    const response = await fetch('/api/state', { headers: { Authorization: `Bearer ${sessionStorage.getItem('fathi_aqua_session_token')}` } });
    return response.json();
  });
  expect(base.success).toBe(true);

  const durableId = `cust_durable_${Date.now()}`;
  await page.route('**/api/state', async (route) => {
    if (route.request().method() === 'PUT') await route.abort('failed');
    else await route.continue();
  });

  const offlineResult = await page.evaluate(async ({ baseState, baseVersion, durableCustomer }) => {
    const candidate = structuredClone(baseState);
    candidate.customers = [durableCustomer, ...(candidate.customers || [])];
    try {
      await fetch('/api/state', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('fathi_aqua_session_token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: candidate, version: baseVersion, operation: { module: 'crm', action: 'create', entity: 'Customer', entityId: durableCustomer.id } }),
      });
      return false;
    } catch {
      return true;
    }
  }, { baseState: base.state.data, baseVersion: base.state.version, durableCustomer: customer(durableId, 'Durable') });
  expect(offlineResult).toBe(true);

  await page.unroute('**/api/state');
  await page.reload();
  await expect(page.locator('main')).toBeVisible();

  const token = await loginApi(request);
  await expect.poll(async () => {
    const response = await request.get('/api/state', { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json();
    return payload.state?.data?.customers?.some((row) => row.id === durableId) || false;
  }, { timeout: 10_000 }).toBe(true);
});
