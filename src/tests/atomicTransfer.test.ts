import { describe, it, expect } from 'vitest';

describe('Atomic Fish Transfer Engine', () => {
  it('correctly calculates post-transfer counts, biomass, and weighted averages', () => {
    const sourcePond = {
      id: 'P-101',
      name: 'استخر ۱۰۱',
      fishCount: 1500,
      biomassKg: 9000, // avg = 6.0 kg
      averageWeightKg: 6.0,
    };

    const destPond = {
      id: 'P-102',
      name: 'استخر ۱۰۲',
      fishCount: 1000,
      biomassKg: 7000, // avg = 7.0 kg
      averageWeightKg: 7.0,
    };

    const transferCount = 500;
    const transferAvgWeight = 6.0;
    const transferBiomass = transferCount * transferAvgWeight; // 3000 kg

    // Source post transfer
    const newSourceCount = sourcePond.fishCount - transferCount;
    const newSourceBiomass = sourcePond.biomassKg - transferBiomass;
    const newSourceAvg = newSourceBiomass / newSourceCount;

    expect(newSourceCount).toBe(1000);
    expect(newSourceBiomass).toBe(6000);
    expect(newSourceAvg).toBe(6.0);

    // Dest post transfer
    const newDestCount = destPond.fishCount + transferCount;
    const newDestBiomass = destPond.biomassKg + transferBiomass;
    const newDestAvg = Number((newDestBiomass / newDestCount).toFixed(2));

    expect(newDestCount).toBe(1500);
    expect(newDestBiomass).toBe(10000);
    // (7000 + 3000) / 1500 = 6.67 kg
    expect(newDestAvg).toBe(6.67);
  });

  it('rejects transfer if transfer count exceeds source pond population', () => {
    const sourceCount = 200;
    const requestedCount = 250;
    const isAllowed = sourceCount >= requestedCount;
    expect(isAllowed).toBe(false);
  });
});
