import { expect, test } from '@playwright/test';

const CREDENTIALS = {
  username: 'owner',
  password: 'e2e-owner-password-2026',
};

async function waitForBootstrap(request) {
  await expect.poll(async () => {
    const response = await request.get('/api/auth/status');
    if (!response.ok()) return false;
    return (await response.json()).needsBootstrap === false;
  }, { timeout: 20_000, intervals: [200, 300, 500, 1000] }).toBe(true);
}

async function loginAfterBootstrap(request) {
  await waitForBootstrap(request);
  const response = await request.post('/api/auth/login', {
    data: { ...CREDENTIALS, language: 'fa' },
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.token).toMatch(/^fathi_sec_/);
  return payload.token;
}

function customer(id) {
  return {
    id,
    name: 'Durable Recovery Customer',
    companyName: 'Durable Recovery Co',
    category: 'Local Distributor',
    phone: '+1000000000',
    email: `${id}@example.test`,
    country: 'Test',
    city: 'Test City',
    address: '',
    currency: 'IRR',
    status: 'Lead',
    createdAt: new Date().toISOString(),
    totalOrdersCount: 0,
    totalSpent: 0,
    outstandingBalance: 0,
    notes: 'IndexedDB restart recovery E2E',
  };
}

test('IndexedDB outbox blocks stale startup offline then replays and deletes the recovered entry', async ({ page, request }) => {
  const token = await loginAfterBootstrap(request);
  const sessionResponse = await request.get('/api/auth/session', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(sessionResponse.ok()).toBeTruthy();
  const session = await sessionResponse.json();
  const userId = session.user.id;

  const stateResponse = await request.get('/api/state', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(stateResponse.ok()).toBeTruthy();
  const base = await stateResponse.json();
  expect(base.success).toBe(true);
  expect(base.state?.data).toBeTruthy();

  const durableId = `cust_indexeddb_${Date.now()}`;
  const candidate = structuredClone(base.state.data);
  candidate.customers = [customer(durableId), ...(candidate.customers || [])];
  const entryId = `${userId}:e2e-${Date.now()}`;

  await page.addInitScript(({ sessionToken }) => {
    sessionStorage.setItem('fathi_aqua_session_token', sessionToken);
    sessionStorage.setItem('fathi_aqua_lang', 'fa');
  }, { sessionToken: token });
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();

  await page.evaluate(async ({ entry }) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('fathi-aqua-supererp-offline', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('state_outbox')) {
          const store = db.createObjectStore('state_outbox', { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('sequence', 'sequence', { unique: false });
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('state_outbox', 'readwrite');
        tx.objectStore('state_outbox').put(entry);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  }, {
    entry: {
      id: entryId,
      userId,
      sequence: Date.now() * 1000,
      operation: { module: 'crm', action: 'create', entity: 'Customer', entityId: durableId },
      state: candidate,
      createdAt: new Date().toISOString(),
    },
  });

  const storedBeforeReload = await page.evaluate(async ({ id }) => new Promise((resolve, reject) => {
    const request = indexedDB.open('fathi-aqua-supererp-offline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('state_outbox', 'readonly');
      const get = tx.objectStore('state_outbox').get(id);
      get.onsuccess = () => { const found = Boolean(get.result); db.close(); resolve(found); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }), { id: entryId });
  expect(storedBeforeReload).toBe(true);

  await page.route('**/api/state', (route) => route.abort('failed'));
  await page.reload();
  await expect(page.getByText('بازیابی امن تغییرات آفلاین', { exact: true })).toBeVisible();
  await expect(page.getByText(/عملیات ذخیره‌شده در IndexedDB محفوظ است/)).toBeVisible();
  await expect(page.locator('main')).toHaveCount(0);

  await page.unroute('**/api/state');
  await page.getByRole('button', { name: 'تلاش مجدد' }).click();
  await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });

  await expect.poll(async () => {
    const response = await request.get('/api/state', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok()) return false;
    const payload = await response.json();
    return payload.state?.data?.customers?.some((row) => row.id === durableId) || false;
  }, { timeout: 15_000 }).toBe(true);

  const storedAfterReplay = await page.evaluate(async ({ id }) => new Promise((resolve, reject) => {
    const request = indexedDB.open('fathi-aqua-supererp-offline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('state_outbox', 'readonly');
      const get = tx.objectStore('state_outbox').get(id);
      get.onsuccess = () => { const found = Boolean(get.result); db.close(); resolve(found); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }), { id: entryId });
  expect(storedAfterReplay).toBe(false);
});
