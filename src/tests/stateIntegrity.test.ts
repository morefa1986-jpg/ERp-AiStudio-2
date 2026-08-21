import { describe, expect, it } from 'vitest';
import { STATE_COLLECTIONS, validateMutationScope, validateStateMutation, validateStateSnapshot } from '../utils/stateIntegrity';
import { executeAtomicFishTransfer } from '../utils/transferEngine';

function emptyState() {
  return Object.fromEntries(STATE_COLLECTIONS.map((key) => [key, []])) as Record<string, any>;
}

describe('server-side state integrity rules', () => {
  it('requires every persisted ERP collection and non-negative stock', () => {
    expect(validateStateSnapshot(emptyState()).ok).toBe(true);
    expect(validateStateSnapshot({}).ok).toBe(false);
    const bad = emptyState(); bad.inventory = [{ id: 'i1', quantity: -1 }];
    expect(validateStateSnapshot(bad).ok).toBe(false);
  });

  it('rejects an unsafe feeding record even when the UI payload claims it is valid', () => {
    const previous = emptyState();
    previous.ponds = [{ id: 'p1', fishCount: 10, biomassKg: 10, feedingStatus: 'ACTIVE' }];
    previous.inventory = [{ id: 'feed_1', quantity: 10, unit: 'kg' }];
    const next = structuredClone(previous);
    const timestamp = new Date().toISOString();
    next.waterLogs = [{ id: 'w1', pondId: 'p1', timestamp, dissolvedOxygen: 2, temperature: 16, ph: 7.4, ammonia: 0.01, nitrite: 0.01, sensorStatus: 'VALID' }];
    next.ponds[0] = { ...next.ponds[0], lastTelemetryTimestamp: timestamp, sensorQuality: 'VALID', dissolvedOxygen: 2, waterTemperature: 16, ph: 7.4, ammonia: 0.01, nitrite: 0.01 };
    next.feedingRecords = [{ id: 'f1', pondId: 'p1', actualAmountKg: 1, unit: 'kg', telemetryTimestamp: timestamp }];
    next.inventory = [{ id: 'feed_1', quantity: 9, unit: 'kg' }];
    next.inventoryTxs = [{ id: 'tx1', itemId: 'feed_1', referenceDoc: 'f1', quantityChange: -1, unit: 'kg', resultingQuantity: 9 }];
    expect(validateStateMutation(previous, next, { module: 'feeding', action: 'create' })).toMatchObject({ ok: false, error: 'FEEDING_SAFETY_FAILED' });
  });

  it('limits a module mutation to its own collections', () => {
    const previous = emptyState();
    const next = structuredClone(previous);
    next.accounts = [{ id: 'account_1' }];
    expect(validateMutationScope(previous, next, { module: 'feeding', action: 'create' })).toMatchObject({ ok: false, error: 'STATE_MUTATION_SCOPE_VIOLATION' });
    expect(validateMutationScope(previous, previous, { module: 'feeding', action: 'create' }).ok).toBe(true);
  });

  it('rejects rewriting an accepted telemetry or stock ledger row', () => {
    const previous = emptyState();
    previous.waterLogs = [{ id: 'w1', pondId: 'p1', timestamp: '2026-08-21T10:00:00.000Z', sensorStatus: 'VALID' }];
    const next = structuredClone(previous);
    next.waterLogs[0].dissolvedOxygen = 7;
    expect(validateStateMutation(previous, next, { module: 'water_quality', action: 'edit' })).toMatchObject({ ok: false, error: 'STATE_IMMUTABLE_RECORD_MODIFIED:waterLogs' });
  });

  it('rejects deleting an accepted immutable ledger row', () => {
    const previous = emptyState();
    previous.transfers = [{ id: 'tr1', status: 'COMPLETED' }];
    const next = structuredClone(previous);
    next.transfers = [];
    expect(validateStateMutation(previous, next, { module: 'transfers', action: 'delete' })).toMatchObject({ ok: false, error: 'STATE_IMMUTABLE_RECORD_DELETED:transfers' });
  });

  it('rejects an external transfer without a destination ledger', () => {
    const previous = emptyState();
    previous.ponds = [{ id: 'p1', fishCount: 100, biomassKg: 100 }];
    const next = structuredClone(previous);
    next.ponds[0] = { ...previous.ponds[0], fishCount: 90, biomassKg: 90 };
    next.transfers = [{ id: 'tr1', status: 'COMPLETED', sourceId: 'p1', destinationType: 'Processing', fishCount: 10, totalBiomassKg: 10 }];
    expect(validateStateMutation(previous, next, { module: 'transfers', action: 'create' })).toMatchObject({ ok: false, error: 'TRANSFER_DESTINATION_LEDGER_REQUIRED' });
  });

  it('validates a pond-to-nursery transfer against both biological ledgers', () => {
    const previous = emptyState();
    previous.ponds = [
      { id: 'p1', fishCount: 100, biomassKg: 100, averageWeightKg: 1 },
      { id: 'p2', fishCount: 0, biomassKg: 0, averageWeightKg: 0 },
    ];
    previous.nurseryTanks = [{ id: 'tank1', fishCount: 0, totalBiomassGrams: 0, avgWeightGrams: 0, status: 'Empty' }];
    const transfer = {
      sourceType: 'Pond' as const, sourceId: 'p1', sourceName: 'P1', destinationType: 'Nursery' as const, destinationId: 'tank1', destinationName: 'N1',
      speciesId: 'sp1', speciesName: 'Species', fishCount: 10, averageWeightKg: 1, totalBiomassKg: 10, date: '2026-08-21', operator: 'user', reason: 'grading',
    };
    const result = executeAtomicFishTransfer(transfer, previous.ponds, previous.nurseryTanks, previous.larvae);
    expect(result.success).toBe(true);
    const next = structuredClone(previous);
    next.ponds = result.updatedPonds;
    next.nurseryTanks = result.updatedNurseryTanks;
    next.larvae = result.updatedLarvae;
    next.transfers = [result.newTransfer];
    expect(validateStateMutation(previous, next, { module: 'transfers', action: 'create' }).ok).toBe(true);
  });

  it('allows an approved restore to replace immutable ledgers after snapshot validation', () => {
    const previous = emptyState();
    previous.waterLogs = [{ id: 'w1', pondId: 'p1', timestamp: '2026-08-21T10:00:00.000Z', sensorStatus: 'VALID' }];
    const next = emptyState();
    next.waterLogs = [{ id: 'w2', pondId: 'p1', timestamp: '2026-08-21T11:00:00.000Z', sensorStatus: 'VALID' }];
    expect(validateStateMutation(previous, next, { module: 'backup', action: 'approve' }).ok).toBe(true);
    expect(validateMutationScope(previous, next, { module: 'backup', action: 'approve' }).ok).toBe(true);
  });

  it('rejects cold-storage edits that are not paired with a fulfilled sale', () => {
    const previous = emptyState();
    previous.coldStorage = [{ id: 'lot_1', sku: 'FIL-1', weightKg: 10, unitsCount: 0 }];
    const next = structuredClone(previous);
    next.coldStorage[0].weightKg = 9;
    expect(validateStateMutation(previous, next, { module: 'sales', action: 'edit' })).toMatchObject({ ok: false, error: 'SALE_FULFILLMENT_LEDGER_MISSING' });
  });

  it('requires stock quantity changes to have a matching immutable transaction', () => {
    const previous = emptyState();
    previous.inventory = [{ id: 'feed_1', sku: 'F-1', quantity: 10, unit: 'kg' }];
    const next = structuredClone(previous);
    next.inventory[0].quantity = 9;
    expect(validateStateMutation(previous, next, { module: 'warehouse', action: 'edit' })).toMatchObject({ ok: false, error: 'INVENTORY_CONSERVATION_FAILED' });
  });

  it('requires mortality count and biomass deltas to match the mortality ledger', () => {
    const previous = emptyState();
    previous.ponds = [{ id: 'p1', fishCount: 100, biomassKg: 50, averageWeightKg: 0.5, dailyMortalityCount: 0 }];
    const next = structuredClone(previous);
    next.ponds[0] = { ...previous.ponds[0], fishCount: 98, biomassKg: 49, dailyMortalityCount: 2 };
    next.mortalityRecords = [{ id: 'm1', pondId: 'p1', count: 2, estimatedWeightKg: 0.5 }];
    expect(validateStateMutation(previous, next, { module: 'mortality', action: 'create' })).toMatchObject({ ok: false, error: 'MORTALITY_CONSERVATION_FAILED' });
  });

  it('does not allow a stopped pond to resume without fresh safe telemetry', () => {
    const previous = emptyState();
    previous.ponds = [{ id: 'p1', fishCount: 10, biomassKg: 10, averageWeightKg: 1, feedingStatus: 'STOPPED' }];
    const next = structuredClone(previous);
    next.ponds[0].feedingStatus = 'ACTIVE';
    expect(validateStateMutation(previous, next, { module: 'feeding', action: 'approve' })).toMatchObject({ ok: false, error: 'FEEDING_TELEMETRY_NOT_AUTHORITATIVE' });
  });

  it('rejects an active feeding pond when telemetry is missing or unsafe, regardless of operation module', () => {
    const previous = emptyState();
    previous.ponds = [{ id: 'p1', fishCount: 10, biomassKg: 10, averageWeightKg: 1, feedingStatus: 'ACTIVE' }];
    const next = structuredClone(previous);
    expect(validateStateMutation(previous, next, { module: 'settings', action: 'manage' })).toMatchObject({ ok: false, error: 'FEEDING_TELEMETRY_NOT_AUTHORITATIVE' });

    const unsafe = structuredClone(previous);
    const timestamp = new Date().toISOString();
    unsafe.waterLogs = [{ id: 'w1', pondId: 'p1', timestamp, sensorStatus: 'VALID', dissolvedOxygen: 3, temperature: 16, ph: 7.2, ammonia: 0.01, nitrite: 0.05 }];
    unsafe.ponds[0] = { ...unsafe.ponds[0], lastTelemetryTimestamp: timestamp, sensorQuality: 'VALID', dissolvedOxygen: 3, waterTemperature: 16, ph: 7.2, ammonia: 0.01, nitrite: 0.05 };
    expect(validateStateMutation(previous, unsafe, { module: 'water_quality', action: 'create' })).toMatchObject({ ok: false, error: 'FEEDING_SAFETY_FAILED' });
  });
});
