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

test('master data creation and hall-scoped user filtering are server authoritative', async ({ request }) => {
  const token = await loginApi(request);
  const suffix = Date.now();
  const auth = { Authorization: `Bearer ${token}` };

  const speciesResponse = await request.post('/api/master-data/species', {
    headers: auth,
    data: {
      faName: `گونه تست ${suffix}`,
      enName: `E2E Species ${suffix}`,
      scientificName: `Acipenser e2e ${suffix}`,
      origin: 'E2E',
      geneticLine: 'E2E-LINE',
      description: 'E2E master data',
      optimumTempMin: 14,
      optimumTempMax: 18,
      optimumDOMin: 6,
      optimumpHMin: 7,
      optimumpHMax: 8.2,
      standardFCR: 1.1,
      feedingProfileCoeff: 1,
      caviarMaturityYears: 8,
    },
  });
  expect(speciesResponse.ok()).toBeTruthy();
  const speciesPayload = await speciesResponse.json();
  const speciesId = speciesPayload.entity.id;

  const hallResponse = await request.post('/api/master-data/halls', {
    headers: auth,
    data: { number: `H-${suffix}`, name: `E2E Hall ${suffix}`, description: 'Scoped hall' },
  });
  expect(hallResponse.ok()).toBeTruthy();
  const hallPayload = await hallResponse.json();
  const hallId = hallPayload.entity.id;

  const pondResponse = await request.post('/api/master-data/ponds', {
    headers: auth,
    data: {
      hallId,
      number: `P-${suffix}`,
      name: `E2E Pond ${suffix}`,
      shape: 'Rectangular',
      lengthMeters: 10,
      widthMeters: 5,
      depthMeters: 2,
      stockGroups: [{ speciesId, sex: 'Unknown', count: 100, averageWeightKg: 2.5, chipNumbers: [] }],
    },
  });
  expect(pondResponse.ok()).toBeTruthy();
  const pondPayload = await pondResponse.json();
  const pondId = pondPayload.entity.id;
  expect(pondPayload.entity).toMatchObject({ hallId, fishCount: 100, biomassKg: 250, feedingStatus: 'STOPPED', sensorQuality: 'OFFLINE' });
  expect(pondPayload.entity.capacityCubicMeters).toBe(100);

  const missingScope = await request.post('/api/auth/users', {
    headers: auth,
    data: { username: `noscope${suffix}`, fullName: 'No Scope', email: `noscope${suffix}@example.test`, role: 'Hall Manager', password: 'e2e-scoped-password-2026', preferredLanguage: 'fa' },
  });
  expect(missingScope.status()).toBe(400);

  const scopedUsername = `scoped${suffix}`;
  const scopedPassword = 'e2e-scoped-password-2026';
  const userResponse = await request.post('/api/auth/users', {
    headers: auth,
    data: { username: scopedUsername, fullName: 'Scoped Manager', email: `${scopedUsername}@example.test`, role: 'Hall Manager', password: scopedPassword, preferredLanguage: 'fa', hallScope: [hallId], pondScope: [] },
  });
  expect(userResponse.ok()).toBeTruthy();

  const scopedLogin = await request.post('/api/auth/login', { data: { username: scopedUsername, password: scopedPassword, language: 'fa' } });
  expect(scopedLogin.ok()).toBeTruthy();
  const scopedToken = (await scopedLogin.json()).token;
  const scopedStateResponse = await request.get('/api/state', { headers: { Authorization: `Bearer ${scopedToken}` } });
  expect(scopedStateResponse.ok()).toBeTruthy();
  const scopedState = await scopedStateResponse.json();
  expect(scopedState.state.data.halls.map((row) => row.id)).toEqual([hallId]);
  expect(scopedState.state.data.ponds.map((row) => row.id)).toEqual([pondId]);
});

test('IndexedDB outbox blocks stale startup offline then replays and deletes the recovered entry', async ({ page, request }) => {
  await loginBrowser(page);
  const token = await page.evaluate(() => sessionStorage.getItem('fathi_aqua_session_token'));
  expect(token).toMatch(/^fathi_sec_/);

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
  candidate.customers = [customer(durableId, 'IndexedDB'), ...(candidate.customers || [])];
  const entryId = `${userId}:e2e-${Date.now()}`;

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
