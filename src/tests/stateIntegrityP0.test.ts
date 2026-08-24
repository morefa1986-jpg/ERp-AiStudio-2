import { describe, expect, it } from 'vitest';
import { STATE_COLLECTIONS, validateStateMutation } from '../utils/stateIntegrity';

const emptyState = (): Record<string, any[]> => Object.fromEntries(STATE_COLLECTIONS.map((key) => [key, []]));

function processingState() {
  const state = emptyState();
  state.ponds = [{
    id: 'pond-1', hallId: 'hall-1', fishCount: 100, biomassKg: 100, averageWeightKg: 1,
    feedingStatus: 'STOPPED', dailyMortalityCount: 0,
  }];
  return state;
}

function processingMutation(previous: Record<string, any[]>) {
  const next = structuredClone(previous);
  next.ponds[0] = { ...next.ponds[0], fishCount: 90, biomassKg: 90, averageWeightKg: 1 };
  next.processingBatches = [{
    id: 'proc-1', batchCode: 'PROC-1', date: '2026-08-23', sourcePondId: 'pond-1',
    fishCount: 10, liveBiomassKg: 10, caviarYieldKg: 1, filletMeatYieldKg: 0,
    smokedMeatYieldKg: 0, byProductAndWasteKg: 9, outputLotIds: ['lot-1'],
  }];
  next.coldStorage = [{
    id: 'lot-1', sku: 'CAV-PROC-1', processingBatchId: 'proc-1', batchCode: 'PROC-1', productType: 'Caviar (Cans/Jars)',
    weightKg: 1, unitsCount: 20, entryDate: '2026-08-23', expiryDate: '2026-12-23', status: 'Stored',
  }];
  return next;
}

function saleState() {
  const state = emptyState();
  state.processingBatches = [{
    id: 'proc-1', batchCode: 'PROC-1', date: '2026-08-01', sourcePondId: 'pond-1', fishCount: 1, liveBiomassKg: 1,
    caviarYieldKg: 1, filletMeatYieldKg: 0, smokedMeatYieldKg: 0, byProductAndWasteKg: 0,
    outputLotIds: ['lot-1'], citesPermitNumber: 'CITES-TEST-1',
  }];
  state.coldStorage = [{
    id: 'lot-1', sku: 'CAV-PROC-1', processingBatchId: 'proc-1', batchCode: 'PROC-1', productType: 'Caviar (Cans/Jars)',
    weightKg: 1, unitsCount: 20, packagingUnit: '50g can', entryDate: '2026-08-01', expiryDate: '2027-08-01', status: 'Stored',
  }];
  state.customers = [{ id: 'cust-1', category: 'Export Luxury Distributor', country: 'UAE' }];
  state.proformas = [{
    id: 'prof-1', customerId: 'cust-1', customerCountry: 'UAE', stage: 'Invoice Issued (صدور فاکتور)',
    items: [{ id: 'item-1', sku: 'CAV-PROC-1', coldStorageLotId: 'lot-1', processingBatchId: 'proc-1', productName: 'Caviar', quantity: 2, unit: 'piece', unitPrice: 100, taxPercent: 0, discount: 0, total: 200 }],
  }];
  return state;
}

describe('P0 server invariants', () => {
  it('blocks processing while an active treatment exists', () => {
    const previous = processingState();
    previous.treatments = [{ id: 'treat-1', pondId: 'pond-1', status: 'ACTIVE', withdrawalEndDate: '2026-08-30' }];
    const result = validateStateMutation(previous, processingMutation(previous), { module: 'processing', action: 'create' });
    expect(result).toEqual({ ok: false, error: 'PROCESSING_TREATMENT_WITHDRAWAL_HOLD' });
  });

  it('blocks processing until a completed treatment withdrawal period has ended', () => {
    const previous = processingState();
    previous.treatments = [{ id: 'treat-1', pondId: 'pond-1', status: 'COMPLETED', withdrawalEndDate: '2026-08-25' }];
    const result = validateStateMutation(previous, processingMutation(previous), { module: 'processing', action: 'create' });
    expect(result).toEqual({ ok: false, error: 'PROCESSING_TREATMENT_WITHDRAWAL_HOLD' });
  });

  it('allows processing after the withdrawal period when conservation holds', () => {
    const previous = processingState();
    previous.treatments = [{ id: 'treat-1', pondId: 'pond-1', status: 'COMPLETED', withdrawalEndDate: '2026-08-20' }];
    const result = validateStateMutation(previous, processingMutation(previous), { module: 'processing', action: 'create' });
    expect(result.ok).toBe(true);
  });

  it('rejects cold-storage fulfillment on Payment Received', () => {
    const previous = saleState();
    const next = structuredClone(previous);
    next.coldStorage[0] = { ...next.coldStorage[0], unitsCount: 18, weightKg: 0.9 };
    next.proformas[0] = {
      ...next.proformas[0], stage: 'Payment Received (تسویه)', fulfilledAt: '2026-08-23T12:00:00.000Z', fulfillmentTransactionId: 'sale-1',
    };
    const result = validateStateMutation(previous, next, { module: 'sales', action: 'edit' });
    expect(result).toEqual({ ok: false, error: 'SALE_FULFILLMENT_REQUIRES_DISPATCH_STAGE' });
  });

  it('allows physical fulfillment only on dispatch with exact lot/process traceability', () => {
    const previous = saleState();
    const next = structuredClone(previous);
    next.coldStorage[0] = { ...next.coldStorage[0], unitsCount: 18, weightKg: 0.9 };
    next.proformas[0] = {
      ...next.proformas[0], stage: 'Dispatched / Delivery (تحویل)', fulfilledAt: '2026-08-23T12:00:00.000Z', fulfillmentTransactionId: 'sale-1',
    };
    const result = validateStateMutation(previous, next, { module: 'sales', action: 'edit' });
    expect(result.ok).toBe(true);
  });
});
