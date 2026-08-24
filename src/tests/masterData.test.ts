import { describe, expect, it } from 'vitest';
import { createHallMaster, createPondMaster, createSpeciesMaster, updatePondMetadata } from '../../server/masterData';

function baseState() {
  return {
    halls: [], ponds: [], species: [], feedingRecords: [], biometricSessions: [], waterLogs: [], mortalityRecords: [],
    treatments: [], transfers: [], broodstock: [], fertilizations: [], incubators: [], larvae: [], nurseryTanks: [],
    inventory: [], inventoryTxs: [], labSamples: [], processingBatches: [], coldStorage: [], customers: [], proformas: [],
    accounts: [], journals: [], employees: [], attendance: [], payrolls: [], equipment: [], socialPosts: [], auditLogs: [], backups: [],
  };
}

function withSpeciesAndHall() {
  let state: Record<string, unknown> = baseState();
  const species = createSpeciesMaster(state, {
    faName: 'گونه آزمایشی', enName: 'Test Sturgeon', scientificName: 'Acipenser testus',
    optimumTempMin: 12, optimumTempMax: 20, optimumDOMin: 6, optimumpHMin: 6.5, optimumpHMax: 8.5,
    standardFCR: 1.1, feedingProfileCoeff: 1, caviarMaturityYears: 8,
  });
  expect(species.ok).toBe(true);
  state = species.state!;
  const hall = createHallMaster(state, { number: 'H-01', name: 'سالن ۱' });
  expect(hall.ok).toBe(true);
  state = hall.state!;
  return { state, speciesId: String(species.entity!.id), hallId: String(hall.entity!.id) };
}

describe('farm master data domain', () => {
  it('creates a hall with derived zero totals', () => {
    const result = createHallMaster(baseState(), { number: 'H-01', name: 'سالن ۱' });
    expect(result.ok).toBe(true);
    expect(result.entity).toMatchObject({ number: 'H-01', pondCount: 0, totalBiomassKg: 0, totalFishCount: 0, isActive: true });
  });

  it('creates a rectangular pond and derives volume plus sex/species stock totals', () => {
    const { state, speciesId, hallId } = withSpeciesAndHall();
    const result = createPondMaster(state, {
      hallId, number: 'P-01', name: 'استخر ۱', shape: 'Rectangular', lengthMeters: 10, widthMeters: 5, depthMeters: 2,
      stockGroups: [
        { speciesId, sex: 'Female', count: 20, averageWeightKg: 4, chipNumbers: ['chip-1', 'chip-2'] },
        { speciesId, sex: 'Male', count: 30, averageWeightKg: 3 },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.entity).toMatchObject({ capacityCubicMeters: 100, fishCount: 50, biomassKg: 170, averageWeightKg: 3.4, feedingStatus: 'STOPPED', sensorQuality: 'OFFLINE' });
    expect((result.entity?.stockGroups as any[]).map((row) => row.sex)).toEqual(['Female', 'Male']);
  });

  it('rejects duplicate chips and invalid physical dimensions', () => {
    const { state, speciesId, hallId } = withSpeciesAndHall();
    const invalidDimensions = createPondMaster(state, { hallId, number: 'P-01', name: 'Pond', shape: 'Circular', diameterMeters: 0, depthMeters: 2 });
    expect(invalidDimensions.ok).toBe(false);
    const first = createPondMaster(state, { hallId, number: 'P-01', name: 'Pond', shape: 'Other', capacityCubicMeters: 50, stockGroups: [{ speciesId, sex: 'Unknown', count: 1, averageWeightKg: 2, chipNumbers: ['chip-x'] }] });
    expect(first.ok).toBe(true);
    const duplicate = createPondMaster(first.state!, { hallId, number: 'P-02', name: 'Pond 2', shape: 'Other', capacityCubicMeters: 50, stockGroups: [{ speciesId, sex: 'Unknown', count: 1, averageWeightKg: 2, chipNumbers: ['chip-x'] }] });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.error).toBe('POND_STOCK_CHIP_DUPLICATE');
  });

  it('updates pond metadata without changing biological inventory', () => {
    const { state, speciesId, hallId } = withSpeciesAndHall();
    const created = createPondMaster(state, { hallId, number: 'P-01', name: 'Old', shape: 'Rectangular', lengthMeters: 10, widthMeters: 5, depthMeters: 2, stockGroups: [{ speciesId, sex: 'Unknown', count: 10, averageWeightKg: 2 }] });
    const pondId = String(created.entity!.id);
    const updated = updatePondMetadata(created.state!, pondId, { name: 'New', shape: 'Rectangular', lengthMeters: 12, widthMeters: 5, depthMeters: 2 });
    expect(updated.ok).toBe(true);
    expect(updated.entity).toMatchObject({ name: 'New', capacityCubicMeters: 120, fishCount: 10, biomassKg: 20 });
  });
});
