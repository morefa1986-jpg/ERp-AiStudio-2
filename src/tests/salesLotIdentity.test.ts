import { describe, expect, it } from 'vitest';
import { ColdStoragePallet } from '../types';
import { saleLotMatchesSku } from '../utils/salesEngine';

function lot(overrides: Partial<ColdStoragePallet> = {}): ColdStoragePallet {
  return {
    id: 'lot-a', slotCode: 'A-1', temperatureC: -2, productType: 'Caviar (Cans/Jars)', batchCode: 'BATCH-A',
    weightKg: 1, unitsCount: 10, packagingUnit: 'can', entryDate: '2026-08-01', expiryDate: '2027-08-01',
    status: 'Stored', ...overrides,
  } as ColdStoragePallet;
}

describe('sale lot identity', () => {
  it('matches a legacy lot only when product family and batchCode both match', () => {
    expect(saleLotMatchesSku(lot(), 'CAV-BATCH-A')).toBe(true);
    expect(saleLotMatchesSku(lot(), 'CAV-BATCH-B')).toBe(false);
  });

  it('prefers an explicit SKU and never falls back to another batch identity', () => {
    const explicit = lot({ sku: 'CAV-CUSTOM-001' });
    expect(saleLotMatchesSku(explicit, 'CAV-CUSTOM-001')).toBe(true);
    expect(saleLotMatchesSku(explicit, 'CAV-BATCH-A')).toBe(false);
  });

  it('does not treat every caviar lot as interchangeable', () => {
    const lots = [lot({ id: 'a', batchCode: 'BATCH-A' }), lot({ id: 'b', batchCode: 'BATCH-B' })];
    expect(lots.filter((row) => saleLotMatchesSku(row, 'CAV-BATCH-A')).map((row) => row.id)).toEqual(['a']);
  });
});
