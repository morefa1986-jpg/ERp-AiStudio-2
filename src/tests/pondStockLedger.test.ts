import { describe, expect, it } from 'vitest';
import type { Pond } from '../types';
import { addPondStock, consumePondStock, pondStockLedgerIsConsistent } from '../utils/pondStockLedger';

const mixed: Pond = {
  id: 'pond-mixed', number: 'M-1', name: 'Mixed', hallId: 'hall-1', capacityCubicMeters: 100,
  fishCount: 30, speciesId: 'sp-a',
  speciesMix: [{ speciesId: 'sp-a', count: 20, avgWeightKg: 2 }, { speciesId: 'sp-b', count: 10, avgWeightKg: 3 }],
  stockGroups: [
    { speciesId: 'sp-a', sex: 'Female', count: 12, averageWeightKg: 2, chipNumbers: ['chip-1', 'chip-2'] },
    { speciesId: 'sp-a', sex: 'Male', count: 8, averageWeightKg: 2, chipNumbers: [] },
    { speciesId: 'sp-b', sex: 'Unknown', count: 10, averageWeightKg: 3, chipNumbers: [] },
  ],
  biomassKg: 70, averageWeightKg: 70 / 30, lastFeedingKg: 0, lastFeedingTime: '', feedingStatus: 'STOPPED', fcr: 0,
  dailyMortalityCount: 0, waterTemperature: 0, dissolvedOxygen: 0, ph: 0, lastBiometryDate: '', criticalAlerts: [],
};

describe('pond mixed-stock ledger', () => {
  it('requires sex when one species has multiple stock groups', () => {
    expect(consumePondStock(mixed, { speciesId: 'sp-a', count: 1, biomassKg: 2 })).toMatchObject({ ok: false, error: 'STOCK_GROUP_SEX_REQUIRED' });
  });

  it('consumes the selected species/sex and keeps aggregate totals synchronized', () => {
    const result = consumePondStock(mixed, { speciesId: 'sp-a', sex: 'Male', count: 3, biomassKg: 6 });
    expect(result.ok).toBe(true);
    expect(result.pond).toMatchObject({ fishCount: 27, biomassKg: 64 });
    expect(result.pond?.stockGroups?.find((row) => row.speciesId === 'sp-a' && row.sex === 'Male')?.count).toBe(5);
    expect(result.pond?.stockGroups?.find((row) => row.speciesId === 'sp-a' && row.sex === 'Female')?.count).toBe(12);
    expect(pondStockLedgerIsConsistent(result.pond!)).toBe(true);
  });

  it('moves registered chip identity only when explicitly selected', () => {
    const consumed = consumePondStock(mixed, { speciesId: 'sp-a', sex: 'Female', count: 2, biomassKg: 4, chipNumbers: ['chip-1'] });
    expect(consumed.ok).toBe(true);
    expect(consumed.pond?.stockGroups?.find((row) => row.sex === 'Female')?.chipNumbers).toEqual(['chip-2']);
    const destination = { ...mixed, id: 'pond-empty', fishCount: 0, biomassKg: 0, averageWeightKg: 0, speciesId: '', speciesMix: [], stockGroups: [] };
    const added = addPondStock(destination, { speciesId: 'sp-a', sex: 'Female', count: 2, biomassKg: 4, chipNumbers: ['chip-1'] });
    expect(added.ok).toBe(true);
    expect(added.pond?.stockGroups?.[0]).toMatchObject({ speciesId: 'sp-a', sex: 'Female', count: 2, chipNumbers: ['chip-1'] });
  });
});
