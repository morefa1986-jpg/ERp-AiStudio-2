import { describe, expect, it } from 'vitest';
import { STATE_COLLECTIONS, validateStateMutation, validateStateSnapshot } from '../utils/stateIntegrity';
import { applyBiometryToPondStock, applyMortalityToPondStock } from '../utils/pondStockOperations';
import { executeAtomicFishTransfer } from '../utils/transferEngine';

function emptyState() {
  return Object.fromEntries(STATE_COLLECTIONS.map((key) => [key, []])) as Record<string, any>;
}

function pond(id: string, female = 10, male = 10) {
  const femaleWeight = 4;
  const maleWeight = 3;
  return {
    id, number: id, name: id, hallId: 'hall-1', capacityCubicMeters: 100,
    speciesId: 'sp-a', fishCount: female + male, biomassKg: female * femaleWeight + male * maleWeight,
    averageWeightKg: (female * femaleWeight + male * maleWeight) / Math.max(1, female + male),
    speciesMix: [{ speciesId: 'sp-a', count: female + male, avgWeightKg: (female * femaleWeight + male * maleWeight) / Math.max(1, female + male) }],
    stockGroups: [
      { speciesId: 'sp-a', sex: 'Female', count: female, averageWeightKg: femaleWeight, chipNumbers: female ? ['F-001'] : [] },
      { speciesId: 'sp-a', sex: 'Male', count: male, averageWeightKg: maleWeight, chipNumbers: [] },
    ].filter((group) => group.count > 0),
    lastFeedingKg: 0, lastFeedingTime: '', feedingStatus: 'STOPPED', fcr: 0, dailyMortalityCount: 0,
    waterTemperature: 0, dissolvedOxygen: 0, ph: 0, lastBiometryDate: '', criticalAlerts: [],
  };
}

describe('server mixed-stock integrity', () => {
  it('rejects a snapshot whose aggregate totals do not match stock groups', () => {
    const state = emptyState();
    state.ponds = [pond('p1')];
    state.ponds[0].fishCount += 1;
    expect(validateStateSnapshot(state)).toEqual({ ok: false, error: 'STATE_POND_STOCK_LEDGER_INVALID' });
  });

  it('accepts a stock-aware mortality only when the selected group mutation matches', () => {
    const previous = emptyState();
    previous.ponds = [pond('p1')];
    const applied = applyMortalityToPondStock(previous.ponds[0], { speciesId: 'sp-a', stockSex: 'Female', count: 1, biomassKg: 4, chipNumbers: ['F-001'] });
    expect(applied.ok).toBe(true);
    const next = structuredClone(previous);
    next.ponds = [{ ...applied.pond, dailyMortalityCount: 1 }];
    next.mortalityRecords = [{ id: 'm1', pondId: 'p1', speciesId: 'sp-a', stockSex: 'Female', chipNumbers: ['F-001'], count: 1, estimatedWeightKg: 4 }];
    expect(validateStateMutation(previous, next, { module: 'mortality', action: 'create' }).ok).toBe(true);

    const forged = structuredClone(next);
    forged.ponds[0].stockGroups[0].count = 8;
    forged.ponds[0].stockGroups[0].averageWeightKg = 4.5;
    forged.ponds[0].fishCount = 18;
    forged.ponds[0].biomassKg = 66;
    forged.ponds[0].averageWeightKg = 66 / 18;
    forged.ponds[0].speciesMix = [{ speciesId: 'sp-a', count: 18, avgWeightKg: 66 / 18 }];
    expect(validateStateMutation(previous, forged, { module: 'mortality', action: 'create' })).toMatchObject({ ok: false });
  });

  it('accepts stock-aware biometry and rejects changing the wrong sex group', () => {
    const previous = emptyState();
    previous.ponds = [pond('p1')];
    const applied = applyBiometryToPondStock(previous.ponds[0], { speciesId: 'sp-a', stockSex: 'Male', averageWeightKg: 3.5, date: '2026-08-24' });
    expect(applied.ok).toBe(true);
    const next = structuredClone(previous);
    next.ponds = [applied.pond];
    next.biometricSessions = [{
      id: 'b1', pondId: 'p1', speciesId: 'sp-a', stockSex: 'Male', date: '2026-08-24', averageWeightKg: 3.5,
      estimatedCount: 10, estimatedBiomassKg: 35,
    }];
    expect(validateStateMutation(previous, next, { module: 'biometrics', action: 'create' }).ok).toBe(true);

    const forged = structuredClone(next);
    forged.ponds[0].stockGroups[0].averageWeightKg = 4.5;
    forged.ponds[0].biomassKg = 80;
    forged.ponds[0].averageWeightKg = 4;
    forged.ponds[0].speciesMix = [{ speciesId: 'sp-a', count: 20, avgWeightKg: 4 }];
    expect(validateStateMutation(previous, forged, { module: 'biometrics', action: 'create' })).toMatchObject({ ok: false });
  });

  it('accepts pond-to-pond transfer only when species/sex/chip ledgers move together', () => {
    const previous = emptyState();
    previous.ponds = [pond('src'), pond('dst', 0, 10)];
    const transfer = {
      sourceType: 'Pond' as const, sourceId: 'src', sourceName: 'src', destinationType: 'Pond' as const, destinationId: 'dst', destinationName: 'dst',
      speciesId: 'sp-a', speciesName: 'Species', stockSex: 'Female' as const, chipNumbers: ['F-001'], fishCount: 1,
      averageWeightKg: 4, totalBiomassKg: 4, date: '2026-08-24', operator: 'operator', reason: 'stock move',
    };
    const result = executeAtomicFishTransfer(transfer, previous.ponds);
    expect(result.success).toBe(true);
    const next = structuredClone(previous);
    next.ponds = result.updatedPonds;
    next.transfers = [result.newTransfer];
    expect(validateStateMutation(previous, next, { module: 'transfers', action: 'create' }).ok).toBe(true);

    const forged = structuredClone(next);
    const dstFemale = forged.ponds.find((row: any) => row.id === 'dst').stockGroups.find((group: any) => group.sex === 'Female');
    dstFemale.chipNumbers = [];
    expect(validateStateMutation(previous, forged, { module: 'transfers', action: 'create' })).toMatchObject({ ok: false });
  });
});
