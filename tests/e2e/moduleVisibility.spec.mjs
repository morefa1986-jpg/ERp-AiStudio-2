import { expect, test } from '@playwright/test';

const OWNER = { username: 'owner', password: 'e2e-owner-password-2026' };

async function waitForBootstrap(request) {
  await expect.poll(async () => {
    const response = await request.get('/api/auth/status');
    if (!response.ok()) return false;
    return (await response.json()).needsBootstrap === false;
  }, { timeout: 15_000 }).toBe(true);
}

async function ownerToken(request) {
  await waitForBootstrap(request);
  const response = await request.post('/api/auth/login', { data: { ...OWNER, language: 'fa' } });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).token;
}

test('module visibility is shared through the server and locked modules stay enabled', async ({ request }) => {
  const token = await ownerToken(request);
  const auth = { Authorization: `Bearer ${token}` };
  const initialResponse = await request.get('/api/admin/module-visibility', { headers: auth });
  expect(initialResponse.ok()).toBeTruthy();
  const initial = await initialResponse.json();

  const next = { ...initial.visibility, maintenance: false, dashboard: false, adminSettings: false };
  const save = await request.put('/api/admin/module-visibility', { headers: auth, data: { visibility: next } });
  expect(save.ok()).toBeTruthy();
  const saved = await save.json();
  expect(saved.visibility.maintenance).toBe(false);
  expect(saved.visibility.dashboard).toBe(true);
  expect(saved.visibility.adminSettings).toBe(true);

  const secondToken = await ownerToken(request);
  const secondRead = await request.get('/api/admin/module-visibility', { headers: { Authorization: `Bearer ${secondToken}` } });
  expect(secondRead.ok()).toBeTruthy();
  const second = await secondRead.json();
  expect(second.visibility.maintenance).toBe(false);
  expect(second.visibility.dashboard).toBe(true);
  expect(second.visibility.adminSettings).toBe(true);

  const restored = { ...second.visibility, maintenance: initial.visibility.maintenance !== false };
  const restore = await request.put('/api/admin/module-visibility', { headers: auth, data: { visibility: restored } });
  expect(restore.ok()).toBeTruthy();
});
