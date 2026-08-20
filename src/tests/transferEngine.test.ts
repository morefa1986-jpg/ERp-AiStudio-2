import { describe, expect, it } from 'vitest';
import { FishTransfer, Pond } from '../types';
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

describe('Transfer Engine - conservation and external traceability', () => {
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

  it('allows a traceable transfer from a pond to processing and removes live stock only from source', () => {
    const result = executeAtomicFishTransfer(transfer({
      destinationType: 'Processing',
      destinationId: 'processing_line_1',
      destinationName: 'Processing Line 1',
      fishCount: 25,
      averageWeightKg: 4,
      totalBiomassKg: 100,
      reason: 'Harvest',
    }), initialPonds);
    expect(result.success).toBe(true);
    const source = result.updatedPonds!.find((pond) => pond.id === 'pond_src')!;
    const untouchedDestinationPond = result.updatedPonds!.find((pond) => pond.id === 'pond_dst')!;
    expect(source.fishCount).toBe(975);
    expect(source.biomassKg).toBe(3900);
    expect(untouchedDestinationPond.fishCount).toBe(500);
    expect(result.newTransfer?.destinationType).toBe('Processing');
  });
});
