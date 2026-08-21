import { describe, expect, it } from 'vitest';
import { FishTransfer, LarvalBatch, NurseryTank, Pond } from '../types';
import { executeAtomicFishTransfer } from '../utils/transferEngine';

const initialPonds: Pond[] = [
  {
    id: 'pond_src', number: 'P-001', hallId: 'hall_1', name: 'استخر مبدا', capacityCubicMeters: 50,
    speciesId: 'sp_beluga', fishCount: 1000, biomassKg: 4000, averageWeightKg: 4,
    lastFeedingKg: 30, lastFeedingTime: '2026-08-20T07:00:00Z', dissolvedOxygen: 7.5,
    waterTemperature: 16, ph: 7.4, feedingStatus: 'ACTIVE', fcr: 1.1, dailyMortalityCount: 0,
    lastBiometryDate: '2026-08-01', criticalAlerts: [],
  },
  {
    id: 'pond_dst', number: 'P-002', hallId: 'hall_2', name: 'استخر مقصد', capacityCubicMeters: 50,
    speciesId: 'sp_beluga', fishCount: 500, biomassKg: 2000, averageWeightKg: 4,
    lastFeedingKg: 15, lastFeedingTime: '2026-08-20T07:00:00Z', dissolvedOxygen: 7.8,
    waterTemperature: 16, ph: 7.5, feedingStatus: 'ACTIVE', fcr: 1.1, dailyMortalityCount: 0,
    lastBiometryDate: '2026-08-01', criticalAlerts: [],
  },
];

function transfer(overrides: Partial<Omit<FishTransfer, 'id' | 'status'>> = {}): Omit<FishTransfer, 'id' | 'status'> {
  return {
    sourceType: 'Pond', sourceId: 'pond_src', sourceName: 'استخر مبدا',
    destinationType: 'Pond', destinationId: 'pond_dst', destinationName: 'استخر مقصد',
    speciesId: 'sp_beluga', speciesName: 'Huso huso', fishCount: 300, averageWeightKg: 4,
    totalBiomassKg: 1200, date: '2026-08-20', operator: 'Operator', reason: 'Grading',
    ...overrides,
  };
}

describe('Transfer Engine - conservation and fail-closed destinations', () => {
  it('preserves total count and biomass for pond-to-pond transfers', () => {
    const result = executeAtomicFishTransfer(transfer(), initialPonds);
    expect(result.success).toBe(true);
    const finalCount = result.updatedPonds!.reduce((sum, pond) => sum + pond.fishCount, 0);
    const finalBiomass = result.updatedPonds!.reduce((sum, pond) => sum + pond.biomassKg, 0);
    expect(finalCount).toBe(1500);
    expect(finalBiomass).toBe(6000);
    expect(result.updatedPonds!.find((pond) => pond.id === 'pond_src')?.fishCount).toBe(700);
    expect(result.updatedPonds!.find((pond) => pond.id === 'pond_dst')?.fishCount).toBe(800);
  });

  it('rejects excess count, excess biomass, NaN and same-pond transfers', () => {
    expect(executeAtomicFishTransfer(transfer({ fishCount: 1500, totalBiomassKg: 6000 }), initialPonds).success).toBe(false);
    expect(executeAtomicFishTransfer(transfer({ fishCount: 900, averageWeightKg: 5, totalBiomassKg: 4500 }), initialPonds).success).toBe(false);
    expect(executeAtomicFishTransfer(transfer({ averageWeightKg: Number.NaN }), initialPonds).success).toBe(false);
    expect(executeAtomicFishTransfer(transfer({ destinationId: 'pond_src', destinationName: 'استخر مبدا' }), initialPonds).success).toBe(false);
  });

  it('rejects external transfers until the destination ledger can be updated atomically', () => {
    const result = executeAtomicFishTransfer(transfer({
      destinationType: 'Processing',
      destinationId: 'processing_line_1',
      destinationName: 'Processing Line 1',
      fishCount: 25,
      averageWeightKg: 4,
      totalBiomassKg: 100,
      reason: 'Harvest',
    }), initialPonds);
    expect(result.success).toBe(false);
    expect(result.error).toContain('مقصد خارجی');
    expect(initialPonds.find((pond) => pond.id === 'pond_src')).toMatchObject({ fishCount: 1000, biomassKg: 4000 });
  });

  it('moves pond biomass into an empty nursery tank with a destination ledger', () => {
    const tanks: NurseryTank[] = [{ id: 'tank_empty', code: 'N-01', volumeLiters: 1000, fishCount: 0, avgWeightGrams: 0, totalBiomassGrams: 0, feedType: '', dailyFeedGrams: 0, mortalityToday: 0, tempC: 16, doMgL: 7, status: 'Empty' }];
    const result = executeAtomicFishTransfer(transfer({ destinationType: 'Nursery', destinationId: 'tank_empty', destinationName: 'N-01', fishCount: 200, averageWeightKg: 4, totalBiomassKg: 800 }), initialPonds, tanks, []);
    expect(result.success).toBe(true);
    expect(result.updatedPonds?.find((pond) => pond.id === 'pond_src')).toMatchObject({ fishCount: 800, biomassKg: 3200 });
    expect(result.updatedNurseryTanks?.[0]).toMatchObject({ fishCount: 200, totalBiomassGrams: 800000, speciesId: 'sp_beluga' });
  });

  it('moves nursery biomass into a pond and rejects incomplete hatchery ledgers', () => {
    const tanks: NurseryTank[] = [{ id: 'tank_src', code: 'N-01', volumeLiters: 1000, fishCount: 200, avgWeightGrams: 4000, totalBiomassGrams: 800000, speciesId: 'sp_beluga', feedType: '', dailyFeedGrams: 0, mortalityToday: 0, tempC: 16, doMgL: 7, status: 'Active' }];
    const nursery = executeAtomicFishTransfer(transfer({ sourceType: 'Nursery', sourceId: 'tank_src', sourceName: 'N-01', destinationType: 'Pond', destinationId: 'pond_dst', destinationName: 'استخر مقصد', fishCount: 200, averageWeightKg: 4, totalBiomassKg: 800 }), initialPonds, tanks, []);
    expect(nursery.success).toBe(true);
    expect(nursery.updatedNurseryTanks?.[0]).toMatchObject({ fishCount: 0, totalBiomassGrams: 0, status: 'Empty' });
    expect(nursery.updatedPonds?.find((pond) => pond.id === 'pond_dst')).toMatchObject({ fishCount: 700, biomassKg: 2800 });

    const hatcheryBatch: LarvalBatch = {
      id: 'larva_hatchery', batchCode: 'L-1', fertilizationBatchId: 'fert-1', motherBroodstockIds: [], fatherBroodstockIds: [],
      speciesId: 'sp_beluga', speciesName: 'Beluga', hatchDate: '2026-08-20', larvalCount: 1000, totalBiomassKg: 8,
      survivalRatePercent: 100, deformityPercent: 0, initialFeedType: 'Artemia Nauplii', destination: 'Nursery', status: 'Transferred',
    };
    const hatchery = executeAtomicFishTransfer(transfer({ sourceType: 'Hatchery', sourceId: hatcheryBatch.id, sourceName: 'L-1', destinationType: 'Nursery', destinationId: 'tank_src', destinationName: 'N-01', fishCount: 1000, averageWeightKg: 0.008, totalBiomassKg: 8 }), initialPonds, [{ ...tanks[0], fishCount: 0, avgWeightGrams: 0, totalBiomassGrams: 0, status: 'Empty' }], [hatcheryBatch]);
    expect(hatchery.success).toBe(true);
    expect(hatchery.updatedLarvae?.[0]).toMatchObject({ larvalCount: 1000, totalBiomassKg: 8, currentTankId: 'tank_src' });
    expect(hatchery.updatedNurseryTanks?.[0]).toMatchObject({ currentBatchId: hatcheryBatch.id, fishCount: 1000, totalBiomassGrams: 8000 });

    const incomplete = executeAtomicFishTransfer(transfer({ sourceType: 'Hatchery', sourceId: hatcheryBatch.id, destinationType: 'Nursery', destinationId: 'tank_src', fishCount: 1000, averageWeightKg: 0.008, totalBiomassKg: 8 }), initialPonds, tanks, [{ ...hatcheryBatch, totalBiomassKg: undefined }]);
    expect(incomplete.success).toBe(false);
  });
});
