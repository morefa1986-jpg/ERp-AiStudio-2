import { describe, expect, it } from 'vitest';
import type { Pond } from '../types';
import { executeAtomicFishTransfer } from '../utils/transferEngine';

function pond(id: string, groups: Pond['stockGroups']): Pond {
  const fishCount = (groups || []).reduce((sum, row) => sum + row.count, 0);
  const biomassKg = (groups || []).reduce((sum, row) => sum + row.count * row.averageWeightKg, 0);
  const speciesMap = new Map<string, { count: number; biomass: number }>();
  for (const row of groups || []) {
    const current = speciesMap.get(row.speciesId) || { count: 0, biomass: 0 };
    current.count += row.count; current.biomass += row.count * row.averageWeightKg; speciesMap.set(row.speciesId, current);
  }
  const speciesMix = [...speciesMap].map(([speciesId, value]) => ({ speciesId, count: value.count, avgWeightKg: value.biomass / value.count }));
  return {
    id, number: id, name: id, hallId: 'hall-1', capacityCubicMeters: 100, fishCount, biomassKg, averageWeightKg: biomassKg / fishCount,
    speciesId: speciesMix[0]?.speciesId || '', speciesMix, stockGroups: groups, lastFeedingKg: 0, lastFeedingTime: '', feedingStatus: 'STOPPED',
    fcr: 0, dailyMortalityCount: 0, waterTemperature: 0, dissolvedOxygen: 0, ph: 0, lastBiometryDate: '', criticalAlerts: [],
  };
}

describe('mixed-stock transfer', () => {
  it('moves only the selected species/sex group and preserves other groups', () => {
    const source = pond('source', [
      { speciesId: 'sp-a', sex: 'Female', count: 10, averageWeightKg: 2, chipNumbers: ['F-001'] },
      { speciesId: 'sp-a', sex: 'Male', count: 8, averageWeightKg: 2, chipNumbers: [] },
      { speciesId: 'sp-b', sex: 'Unknown', count: 5, averageWeightKg: 3, chipNumbers: [] },
    ]);
    const destination = pond('destination', [
      { speciesId: 'sp-b', sex: 'Unknown', count: 4, averageWeightKg: 3, chipNumbers: [] },
    ]);
    const result = executeAtomicFishTransfer({
      sourceType: 'Pond', sourceId: source.id, sourceName: source.name,
      destinationType: 'Pond', destinationId: destination.id, destinationName: destination.name,
      speciesId: 'sp-a', stockSex: 'Female', chipNumbers: ['F-001'], speciesName: 'Species A',
      fishCount: 2, averageWeightKg: 2, totalBiomassKg: 4, date: '2026-08-24', operator: 'Operator', reason: 'Mixed stock transfer',
    }, [source, destination]);
    expect(result.success).toBe(true);
    const afterSource = result.updatedPonds?.find((row) => row.id === source.id)!;
    const afterDestination = result.updatedPonds?.find((row) => row.id === destination.id)!;
    expect(afterSource.stockGroups?.find((row) => row.speciesId === 'sp-a' && row.sex === 'Female')).toMatchObject({ count: 8, chipNumbers: [] });
    expect(afterSource.stockGroups?.find((row) => row.speciesId === 'sp-a' && row.sex === 'Male')?.count).toBe(8);
    expect(afterSource.stockGroups?.find((row) => row.speciesId === 'sp-b')?.count).toBe(5);
    expect(afterDestination.stockGroups?.find((row) => row.speciesId === 'sp-a' && row.sex === 'Female')).toMatchObject({ count: 2, chipNumbers: ['F-001'] });
    expect(afterSource.fishCount + afterDestination.fishCount).toBe(source.fishCount + destination.fishCount);
    expect(afterSource.biomassKg + afterDestination.biomassKg).toBeCloseTo(source.biomassKg + destination.biomassKg, 6);
  });

  it('fails closed when sex is omitted for a species split into multiple sex groups', () => {
    const source = pond('source', [
      { speciesId: 'sp-a', sex: 'Female', count: 10, averageWeightKg: 2, chipNumbers: [] },
      { speciesId: 'sp-a', sex: 'Male', count: 8, averageWeightKg: 2, chipNumbers: [] },
    ]);
    const destination = pond('destination', []);
    const result = executeAtomicFishTransfer({
      sourceType: 'Pond', sourceId: source.id, sourceName: source.name,
      destinationType: 'Pond', destinationId: destination.id, destinationName: destination.name,
      speciesId: 'sp-a', speciesName: 'Species A', fishCount: 2, averageWeightKg: 2, totalBiomassKg: 4,
      date: '2026-08-24', operator: 'Operator', reason: 'No sex selected',
    }, [source, destination]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('جنس');
  });
});
