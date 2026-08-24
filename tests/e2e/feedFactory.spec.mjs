import { expect, test } from '@playwright/test';

const CREDENTIALS = { username: 'owner', password: 'e2e-owner-password-2026' };
test.setTimeout(60_000);

async function waitForBootstrap(request) {
  await expect.poll(async () => {
    const response = await request.get('/api/auth/status');
    if (!response.ok()) return false;
    const payload = await response.json();
    return payload.needsBootstrap === false;
  }, { timeout: 40_000, intervals: [250, 500, 1000] }).toBe(true);
}

async function login(request) {
  await waitForBootstrap(request);
  const response = await request.post('/api/auth/login', { data: { ...CREDENTIALS, language: 'fa' } });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.success).toBe(true);
  return payload.token;
}

async function state(request, token) {
  const response = await request.get('/api/state', { headers: { Authorization: `Bearer ${token}` } });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.success).toBe(true);
  return payload.state;
}

test('feed factory registers raw material, consumes it into WIP, and exposes output only after QC release', async ({ request }) => {
  const token = await login(request);
  const auth = { Authorization: `Bearer ${token}` };
  await expect.poll(async () => {
    const response = await request.get('/api/state', { headers: auth });
    if (!response.ok()) return false;
    const payload = await response.json();
    return Boolean(payload.state?.data?.inventory && payload.state?.data?.inventoryTxs);
  }, { timeout: 15_000 }).toBe(true);

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const rawSku = `E2E-RAW-${suffix}`;
  const rawBatch = `RAW-${suffix}`;
  const formulaCode = `E2E-F-${suffix}`;
  const outputSkuBase = `E2E-OUT-${suffix}`;
  const batchCode = `E2E-B-${suffix}`;
  const outputSku = `${outputSkuBase}-${batchCode}`.toUpperCase();

  const rawResponse = await request.post('/api/feed-factory/raw-materials', {
    headers: auth,
    data: {
      sku: rawSku,
      name: 'E2E feed-factory raw material fixture',
      batchNumber: rawBatch,
      quantity: 25,
      unit: 'kg',
      purchasePricePerUnit: 1000,
      currency: 'IRR',
      expiryDate: '2027-12-31',
      supplierName: 'E2E Fixture Supplier',
      warehouseLocation: 'E2E-RAW-RACK',
      minimumStockThreshold: 2,
      reorderLevel: 5,
    },
  });
  expect(rawResponse.ok()).toBeTruthy();
  const rawPayload = await rawResponse.json();
  expect(rawPayload.success).toBe(true);
  expect(rawPayload.item).toMatchObject({ sku: rawSku, category: 'Raw Material (مواد اولیه خوراک)', quantity: 25, unit: 'kg' });
  const rawId = rawPayload.item.id;

  const formulaResponse = await request.post('/api/feed-factory/formulas', {
    headers: auth,
    data: {
      code: formulaCode,
      name: 'E2E conservation fixture — not a feeding recommendation',
      outputName: 'E2E QC Feed Lot',
      outputSkuBase,
      outputUnit: 'kg',
      basisOutputKg: 10,
      ingredients: [{ itemId: rawId, quantityKg: 10.5 }],
      isActive: true,
    },
  });
  expect(formulaResponse.ok()).toBeTruthy();
  const formula = (await formulaResponse.json()).formula;
  expect(formula.id).toBeTruthy();

  const before = await state(request, token);
  expect(before.data.inventory.find((item) => item.id === rawId)?.quantity).toBe(25);
  expect(before.data.inventory.some((item) => item.sku === outputSku)).toBe(false);

  const startResponse = await request.post('/api/feed-factory/batches', {
    headers: auth,
    data: {
      formulaId: formula.id,
      batchCode,
      outputKg: 10,
      outputSku,
      warehouseLocation: 'E2E-QC-RELEASE',
      expiryDate: '2027-12-31',
      minimumStockThreshold: 1,
      reorderLevel: 2,
    },
  });
  expect(startResponse.ok()).toBeTruthy();
  const started = (await startResponse.json()).batch;
  expect(started).toMatchObject({ batchCode, status: 'PENDING_QC', outputKg: 10, totalInputKg: 10.5, processLossKg: 0.5 });

  const wip = await state(request, token);
  expect(wip.data.inventory.find((item) => item.id === rawId)?.quantity).toBe(14.5);
  expect(wip.data.inventory.some((item) => item.sku === outputSku)).toBe(false);
  expect(wip.data.inventoryTxs.some((tx) => tx.referenceDoc === started.id && tx.itemId === rawId && tx.quantityChange === -10.5)).toBe(true);

  const releaseResponse = await request.post(`/api/feed-factory/batches/${encodeURIComponent(started.id)}/qc`, {
    headers: auth,
    data: { decision: 'RELEASE', notes: 'E2E workflow verification only' },
  });
  expect(releaseResponse.ok()).toBeTruthy();
  const released = (await releaseResponse.json()).batch;
  expect(released.status).toBe('RELEASED');
  expect(released.outputInventoryItemId).toBeTruthy();

  const final = await state(request, token);
  const output = final.data.inventory.find((item) => item.id === released.outputInventoryItemId);
  expect(output).toMatchObject({ sku: outputSku, category: 'Feed (خوراک)', batchNumber: batchCode, quantity: 10, unit: 'kg' });
  expect(final.data.inventoryTxs.some((tx) => tx.referenceDoc === started.id && tx.itemId === output.id && tx.type === 'Production (تولید)' && tx.quantityChange === 10)).toBe(true);

  const batchesResponse = await request.get('/api/feed-factory/batches', { headers: auth });
  expect(batchesResponse.ok()).toBeTruthy();
  const batches = (await batchesResponse.json()).batches;
  expect(batches.find((batch) => batch.id === started.id)).toMatchObject({ status: 'RELEASED', outputInventoryItemId: output.id });
});
