import { describe, it, expect } from 'vitest';
import { executeAtomicFishTransfer } from '../utils/transferEngine';
import { Pond } from '../types';

describe('Transfer Engine - Atomic Conservation & Safety', () => {
  const initialPonds: Pond[] = [
    {
      id: 'pond_src',
      hallId: 'hall_1',
      name: 'استخر ۱ مبدا',
      speciesId: 'sp_beluga',
      fishCount: 1000,
      biomassKg: 4000,
      averageWeightKg: 4.0,
      waterVolumeM3: 50,
      dissolvedOxygen: 7.5,
      waterTemperature: 16.0,
      ph: 7.4,
      feedingStatus: 'NORMAL',
      fcr: 1.1,
    },
    {
      id: 'pond_dst',
      hallId: 'hall_2',
      name: 'استخر ۲ مقصد',
      speciesId: 'sp_beluga',
      fishCount: 500,
      biomassKg: 2000,
      averageWeightKg: 4.0,
      waterVolumeM3: 50,
      dissolvedOxygen: 7.8,
      waterTemperature: 16.0,
      ph: 7.5,
      feedingStatus: 'NORMAL',
      fcr: 1.1,
    },
  ];

  it('strictly preserves total fish count and biomass across ponds during transfer', () => {
    const initialTotalCount = initialPonds.reduce((s, p) => s + p.fishCount, 0); // 1500
    const initialTotalBiomass = initialPonds.reduce((s, p) => s + p.biomassKg, 0); // 6000

    const transferData = {
      date: '2026-03-30',
      sourceId: 'pond_src',
      sourceName: 'استخر ۱ مبدا',
      destinationId: 'pond_dst',
      destinationName: 'استخر ۲ مقصد',
      fishCount: 300,
      averageWeightKg: 4.0,
      operator: 'Reza Mohammadi',
    };

    const result = executeAtomicFishTransfer(transferData, initialPonds);
    expect(result.success).toBe(true);
    expect(result.updatedPonds).toBeDefined();

    const finalTotalCount = result.updatedPonds!.reduce((s, p) => s + p.fishCount, 0);
    const finalTotalBiomass = result.updatedPonds!.reduce((s, p) => s + p.biomassKg, 0);

    expect(finalTotalCount).toBe(initialTotalCount);
    expect(finalTotalBiomass).toBe(initialTotalBiomass);

    const updatedSource = result.updatedPonds!.find((p) => p.id === 'pond_src')!;
    const updatedDest = result.updatedPonds!.find((p) => p.id === 'pond_dst')!;

    expect(updatedSource.fishCount).toBe(700);
    expect(updatedSource.biomassKg).toBe(2800);

    expect(updatedDest.fishCount).toBe(800);
    expect(updatedDest.biomassKg).toBe(3200);
  });

  it('rejects transfer when count exceeds source stock', () => {
    const invalidTransfer = {
      date: '2026-03-30',
      sourceId: 'pond_src',
      sourceName: 'استخر ۱ مبدا',
      destinationId: 'pond_dst',
      destinationName: 'استخر ۲ مقصد',
      fishCount: 1500, // source only has 1000
      averageWeightKg: 4.0,
      operator: 'Reza Mohammadi',
    };

    const result = executeAtomicFishTransfer(invalidTransfer, initialPonds);
    expect(result.success).toBe(false);
    expect(result.error).toContain('بیشتر از موجودی');
  });

  it('rejects transfer to the same pond', () => {
    const invalidTransfer = {
      date: '2026-03-30',
      sourceId: 'pond_src',
      sourceName: 'استخر ۱ مبدا',
      destinationId: 'pond_src',
      destinationName: 'استخر ۱ مبدا',
      fishCount: 100,
      averageWeightKg: 4.0,
      operator: 'Reza Mohammadi',
    };

    const result = executeAtomicFishTransfer(invalidTransfer, initialPonds);
    expect(result.success).toBe(false);
    expect(result.error).toContain('یکسان');
  });
});
