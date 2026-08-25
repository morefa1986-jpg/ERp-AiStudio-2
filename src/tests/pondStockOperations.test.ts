import { describe, expect, it } from 'vitest';
import type { Pond } from '../types';
import { applyBiometryToPondStock, applyMortalityToPondStock } from '../utils/pondStockOperations';

function mixedPond(): Pond {
  return {
    id: 'pond-mixed', number: 'P-1', name: 'Mixed', hallId: 'hall-1', capacityCubicMeters: 100,
    fishCount: 30, speciesId: 'sp-a', biomassKg: 90, averageWeightKg: 3,
    speciesMix: [{ speciesId: 'sp-a', count: 30, avgWeightKg: 3 }],
    stockGroups: [
      { speciesId: 'sp-a', sex: 'Female', count: 10, averageWeightKg: 4, chipNumbers: ['F-001', 'F-002'] },
      { speciesId: 'sp-a', sex: 'Male', count: 20, averageWeightKg: 2.5, chipNumbers: ['M-001'] },
    ],
    lastFeedingKg: 0, lastFeedingTime: '', feedingStatus: 'STOPPED', fcr: 0, dailyMortalityCount: 0,
    waterTemperature: 0, dissolvedOxygen: 0, ph: 0, lastBiometryDate: '', criticalAlerts: [],
  };
}

describe('pond stock operational mutations', () => {
  it('requires sex when one species has multiple stock groups', () => {
    expect(applyMortalityToPondStock(mixedPond(), { speciesId: 'sp-a', count: 1, biomassKg: 4 }).error).toBe('STOCK_GROUP_SEX_REQUIRED');
    expect(applyBiometryToPondStock(mixedPond(), { speciesId: 'sp-a', averageWeightKg: 4.2, date: '2026-08-24' }).error).toBe('STOCK_GROUP_SEX_REQUIRED');
  });

  it('subtracts mortality only from the selected species/sex group and preserves chips', () => {
    const result = applyMortalityToPondStock(mixedPond(), { speciesId: 'sp-a', stockSex: 'Female', count: 1, biomassKg: 4, chipNumbers: ['F-001'] });
    expect(result.ok).toBe(true);
    expect(result.pond).toMatchObject({ fishCount: 29, biomassKg: 86, dailyMortalityCount: 1 });
    expect(result.pond?.stockGroups?.find((group) => group.sex === 'Female')).toMatchObject({ count: 9, averageWeightKg: 4, chipNumbers: ['F-002'] });
    expect(result.pond?.stockGroups?.find((group) => group.sex === 'Male')).toMatchObject({ count: 20, averageWeightKg: 2.5, chipNumbers: ['M-001'] });
    expect(result.pond?.speciesMix?.[0]).toMatchObject({
      speciesId: 'sp-a',
      count: 29,
      maleCount: 20,
      femaleCount: 9,
      unknownSexCount: 0,
      chipNumbers: ['F-002', 'M-001'],
    });
  });

  it('updates only the selected biometry group then recomputes pond aggregates', () => {
    const result = applyBiometryToPondStock(mixedPond(), { speciesId: 'sp-a', stockSex: 'Male', averageWeightKg: 3, date: '2026-08-24' });
    expect(result.ok).toBe(true);
    expect(result.selectedCount).toBe(20);
    expect(result.previousAverageWeightKg).toBe(2.5);
    expect(result.pond).toMatchObject({ fishCount: 30, biomassKg: 100, averageWeightKg: 3.3333, lastBiometryDate: '2026-08-24' });
    expect(result.pond?.stockGroups?.find((group) => group.sex === 'Female')?.averageWeightKg).toBe(4);
    expect(result.pond?.stockGroups?.find((group) => group.sex === 'Male')?.averageWeightKg).toBe(3);
  });
});
