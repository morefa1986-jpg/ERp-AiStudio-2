import { describe, expect, it } from 'vitest';
import { STATE_COLLECTIONS, validateMutationScope, validateStateMutation } from '../utils/stateIntegrity';
import { validateManualPondSnapshotMutation } from '../utils/pondSnapshotValidation';
import { manualSnapshotCapacityCubicMeters } from '../types/pondSnapshot';

function baseState(): Record<string, any> {
  const state = Object.fromEntries(STATE_COLLECTIONS.map((key) => [key, []])) as Record<string, any>;
  state.species = [{ id: 'species-1' }, { id: 'species-2' }];
  state.ponds = [{
    id: 'pond-1',
    number: 'P-01',
    name: 'Pool 1',
    hallId: 'hall-1',
    speciesId: 'species-1',
    fishCount: 100,
    biomassKg: 100,
    averageWeightKg: 1,
    capacityCubicMeters: 50,
    feedingStatus: 'STOPPED',
    waterTemperature: 18,
    dissolvedOxygen: 7,
    ph: 7.5,
  }];
  return state;
}

function validManualPond(previous: Record<string, any>): any {
  const before = previous.ponds[0];
  return {
    ...before,
    speciesId: 'species-1',
    fishCount: 100,
    biomassKg: 110,
    averageWeightKg: 1.1,
    speciesMix: [{
      speciesId: 'species-1',
      count: 100,
      avgWeightKg: 1.1,
      maleCount: 30,
      femaleCount: 40,
      unknownSexCount: 30,
      chipNumbers: ['CHIP-001', 'CHIP-002'],
    }],
    manualWaterTemperature: 17.8,
    pondShape: 'Circular',
    diameterMeters: 8,
    depthMeters: 1.5,
    capacityCubicMeters: Number((Math.PI * 4 * 4 * 1.5).toFixed(2)),
    lastManualSnapshotAt: '2026-08-24T12:00:00.000Z',
    lastManualSnapshotBy: 'Operator',
    manualSnapshotNotes: 'End of shift manual count',
  };
}

describe('manual pond snapshot validation', () => {
  it('allows a scoped, auditable pond edit with species/sex/chip/dimension data', () => {
    const previous = baseState();
    const next = structuredClone(previous);
    next.ponds = [validManualPond(previous)];

    expect(validateMutationScope(previous, next, { module: 'ponds', action: 'edit' })).toEqual({ ok: true });
    expect(validateStateMutation(previous, next, { module: 'ponds', action: 'edit' })).toEqual({ ok: true });
  });

  it('rejects mismatched sex totals', () => {
    const previous = baseState();
    const next = structuredClone(previous);
    const pond = validManualPond(previous);
    pond.speciesMix[0].unknownSexCount = 29;
    next.ponds = [pond];

    expect(validateManualPondSnapshotMutation(previous, next, { module: 'ponds', action: 'edit' })).toEqual({
      ok: false,
      error: 'POND_SEX_TOTAL_MISMATCH',
    });
  });

  it('rejects duplicate chip numbers across species groups', () => {
    const previous = baseState();
    const next = structuredClone(previous);
    next.ponds = [{
      ...validManualPond(previous),
      speciesMix: [
        {
          speciesId: 'species-1', count: 50, avgWeightKg: 1, maleCount: 20, femaleCount: 20, unknownSexCount: 10, chipNumbers: ['DUP-1'],
        },
        {
          speciesId: 'species-2', count: 50, avgWeightKg: 1.2, maleCount: 20, femaleCount: 20, unknownSexCount: 10, chipNumbers: ['DUP-1'],
        },
      ],
      fishCount: 100,
      biomassKg: 110,
      averageWeightKg: 1.1,
    }];

    expect(validateManualPondSnapshotMutation(previous, next, { module: 'ponds', action: 'edit' })).toEqual({
      ok: false,
      error: 'POND_CHIP_DUPLICATE_OR_INVALID',
    });
  });

  it('never allows a manual snapshot to resume feeding', () => {
    const previous = baseState();
    const next = structuredClone(previous);
    next.ponds = [{ ...validManualPond(previous), feedingStatus: 'ACTIVE' }];

    expect(validateManualPondSnapshotMutation(previous, next, { module: 'ponds', action: 'edit' })).toEqual({
      ok: false,
      error: 'FEEDING_RESUME_REQUIRES_APPROVAL',
    });
  });

  it('computes physical capacity from configured dimensions', () => {
    expect(manualSnapshotCapacityCubicMeters({
      speciesMix: [],
      manualWaterTemperature: 18,
      pondShape: 'Rectangular',
      lengthMeters: 10,
      widthMeters: 4,
      depthMeters: 1.5,
      stopFeeding: false,
      notes: 'dimensions',
    }, 1)).toBe(60);
  });
});
