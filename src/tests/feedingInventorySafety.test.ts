import { describe, expect, it } from 'vitest';
import { FeedingRecord, InventoryItem, Pond } from '../types';
import { inventoryQuantityForFeedKg, validateFeedingSubmission } from '../utils/feedingEngine';

const fresh = new Date().toISOString();

const pond: Pond = {
  id: 'pond-1', number: '1', name: 'Pond 1', hallId: 'hall-1', capacityCubicMeters: 100,
  fishCount: 100, speciesId: 'sp-1', biomassKg: 100, averageWeightKg: 1,
  lastFeedingKg: 0, lastFeedingTime: '', feedingStatus: 'ACTIVE', fcr: 1.1, dailyMortalityCount: 0,
  waterTemperature: 16, dissolvedOxygen: 7, ph: 7.4, ammonia: 0.01, nitrite: 0.05,
  lastTelemetryTimestamp: fresh, sensorQuality: 'VALID', lastBiometryDate: '2026-08-01', criticalAlerts: [],
};

const record: Omit<FeedingRecord, 'id' | 'timestamp'> = {
  pondId: pond.id, pondName: pond.name, hallName: 'Hall 1', speciesName: 'Test species', biomassKg: 100,
  recommendedAmountKg: 1, actualAmountKg: 1, unit: 'kg', feedTypeSku: 'FEED-1', feedTypeName: 'Test feed',
  waterTemperature: 16, dissolvedOxygen: 7, telemetryTimestamp: fresh, feedingStatus: 'ACTIVE', operatorName: 'Operator',
};

function feed(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'feed-1', sku: 'FEED-1', name: 'Test feed', category: 'Feed (خوراک)', batchNumber: 'B-1', quantity: 100,
    unit: 'kg', purchasePricePerUnit: 1, currency: 'IRR', supplierName: 'Supplier', warehouseLocation: 'A-1',
    minimumStockThreshold: 5, reorderLevel: 10, status: 'Adequate', ...overrides,
  };
}

describe('feeding inventory safety', () => {
  it('rejects a feed item explicitly marked expired', () => {
    const result = validateFeedingSubmission(record, pond, [feed({ status: 'Expired' })]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('منقضی');
  });

  it('rejects a feed item whose expiry date is already past even when status is stale', () => {
    const result = validateFeedingSubmission(record, pond, [feed({ expiryDate: '2020-01-01', status: 'Adequate' })]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('منقضی');
  });

  it('returns zero inventory conversion for expired feed so server invariants cannot match a forged feeding tx', () => {
    expect(inventoryQuantityForFeedKg(feed({ status: 'Expired' }), 1)).toBe(0);
    expect(inventoryQuantityForFeedKg(feed({ expiryDate: '2020-01-01', status: 'Adequate' }), 1)).toBe(0);
  });

  it('accepts a non-expired feed item when all other feeding safeguards pass', () => {
    const result = validateFeedingSubmission(record, pond, [feed({ expiryDate: '2099-01-01' })]);
    expect(result.success).toBe(true);
  });
});
