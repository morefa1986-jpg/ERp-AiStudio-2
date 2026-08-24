type State = Record<string, any>;

type Operation = { module?: string; action?: string };

const sameValue = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const rows = (state: State, key: string): any[] => Array.isArray(state[key]) ? state[key] : [];
const positive = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value > 0;
const nonNegative = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function validatePondDimensions(pond: any): { ok: boolean; error?: string } {
  if (pond.pondShape === 'Circular') {
    if (!positive(pond.diameterMeters) || !positive(pond.depthMeters)) return { ok: false, error: 'POND_CIRCULAR_DIMENSIONS_REQUIRED' };
    const capacity = Math.PI * Math.pow(Number(pond.diameterMeters) / 2, 2) * Number(pond.depthMeters);
    if (Math.abs(Number(pond.capacityCubicMeters) - capacity) > 0.1) return { ok: false, error: 'POND_CAPACITY_DIMENSION_MISMATCH' };
  }
  if (pond.pondShape === 'Rectangular' || pond.pondShape === 'Raceway') {
    if (!positive(pond.lengthMeters) || !positive(pond.widthMeters) || !positive(pond.depthMeters)) return { ok: false, error: 'POND_RECTANGULAR_DIMENSIONS_REQUIRED' };
    const capacity = Number(pond.lengthMeters) * Number(pond.widthMeters) * Number(pond.depthMeters);
    if (Math.abs(Number(pond.capacityCubicMeters) - capacity) > 0.1) return { ok: false, error: 'POND_CAPACITY_DIMENSION_MISMATCH' };
  }
  if (!positive(pond.capacityCubicMeters)) return { ok: false, error: 'POND_CAPACITY_INVALID' };
  return { ok: true };
}

function validateSpecies(species: any): { ok: boolean; error?: string } {
  if (!species || typeof species.id !== 'string' || !species.id) return { ok: false, error: 'SPECIES_ID_REQUIRED' };
  for (const key of ['faName', 'enName', 'scientificName', 'origin', 'geneticLine', 'description']) {
    if (typeof species[key] !== 'string' || !species[key].trim()) return { ok: false, error: `SPECIES_FIELD_REQUIRED:${key}` };
  }
  const numbers = ['optimumTempMin', 'optimumTempMax', 'optimumDOMin', 'optimumpHMin', 'optimumpHMax', 'standardFCR', 'feedingProfileCoeff', 'caviarMaturityYears'];
  if (numbers.some((key) => !nonNegative(species[key]))) return { ok: false, error: 'SPECIES_LIMITS_INVALID' };
  if (species.optimumTempMin >= species.optimumTempMax || species.optimumpHMin >= species.optimumpHMax || species.optimumDOMin <= 0 || species.standardFCR <= 0 || species.feedingProfileCoeff <= 0) {
    return { ok: false, error: 'SPECIES_LIMITS_INVALID' };
  }
  if (species.isActive !== undefined && typeof species.isActive !== 'boolean') return { ok: false, error: 'SPECIES_STATUS_INVALID' };
  return { ok: true };
}

export function validateFarmStructureSnapshot(state: State): { ok: boolean; error?: string } {
  const halls = rows(state, 'halls');
  const ponds = rows(state, 'ponds');
  const species = rows(state, 'species');
  const hallIds = new Set(halls.map((hall) => hall?.id));
  const speciesIds = new Set(species.map((item) => item?.id));

  if (halls.some((hall) => !hall || typeof hall.number !== 'string' || !hall.number.trim() || typeof hall.name !== 'string' || !hall.name.trim() || typeof hall.description !== 'string' || typeof hall.isActive !== 'boolean')) {
    return { ok: false, error: 'HALL_STRUCTURE_INVALID' };
  }
  if (new Set(halls.map((hall) => hall.number.trim().toLowerCase())).size !== halls.length) return { ok: false, error: 'HALL_NUMBER_DUPLICATE' };
  if (new Set(ponds.map((pond) => String(pond.number || '').trim().toLowerCase())).size !== ponds.length) return { ok: false, error: 'POND_NUMBER_DUPLICATE' };

  for (const item of species) {
    const result = validateSpecies(item);
    if (!result.ok) return result;
  }
  if (new Set(species.map((item) => item.scientificName.trim().toLowerCase())).size !== species.length) return { ok: false, error: 'SPECIES_SCIENTIFIC_NAME_DUPLICATE' };

  for (const pond of ponds) {
    if (!hallIds.has(pond.hallId)) return { ok: false, error: 'POND_HALL_REFERENCE_INVALID' };
    if (!speciesIds.has(pond.speciesId)) return { ok: false, error: 'POND_SPECIES_REFERENCE_INVALID' };
    if (typeof pond.number !== 'string' || !pond.number.trim() || typeof pond.name !== 'string' || !pond.name.trim()) return { ok: false, error: 'POND_IDENTITY_INVALID' };
    const dimensionResult = validatePondDimensions(pond);
    if (!dimensionResult.ok && pond.pondShape && pond.pondShape !== 'Other') return dimensionResult;
  }
  return { ok: true };
}

export function validateFarmStructureMutation(previous: State, next: State, operation: Operation): { ok: boolean; error?: string } {
  if (operation.module !== 'settings' || operation.action !== 'manage') return { ok: false, error: 'FARM_STRUCTURE_OPERATION_INVALID' };
  const snapshotCheck = validateFarmStructureSnapshot(next);
  if (!snapshotCheck.ok) return snapshotCheck;

  const previousHalls = new Map(rows(previous, 'halls').map((row) => [row.id, row]));
  const previousPonds = new Map(rows(previous, 'ponds').map((row) => [row.id, row]));
  const previousSpecies = new Map(rows(previous, 'species').map((row) => [row.id, row]));

  for (const hall of rows(previous, 'halls')) {
    if (!rows(next, 'halls').some((row) => row.id === hall.id)) return { ok: false, error: 'HALL_DELETE_FORBIDDEN_USE_DEACTIVATE' };
  }
  for (const pond of rows(previous, 'ponds')) {
    if (!rows(next, 'ponds').some((row) => row.id === pond.id)) return { ok: false, error: 'POND_DELETE_FORBIDDEN' };
  }
  for (const item of rows(previous, 'species')) {
    if (!rows(next, 'species').some((row) => row.id === item.id)) return { ok: false, error: 'SPECIES_DELETE_FORBIDDEN_USE_DEACTIVATE' };
  }

  for (const pond of rows(next, 'ponds')) {
    const before = previousPonds.get(pond.id);
    if (!before) {
      if (pond.fishCount !== 0 || pond.biomassKg !== 0 || pond.averageWeightKg !== 0 || pond.feedingStatus !== 'STOPPED') {
        return { ok: false, error: 'NEW_POND_MUST_START_EMPTY_AND_STOPPED' };
      }
      continue;
    }

    // Structure settings may not rewrite biological inventory, safety telemetry,
    // feeding decisions or operational ledgers. Those have dedicated workflows.
    const protectedFields = [
      'fishCount', 'biomassKg', 'averageWeightKg', 'lastFeedingKg', 'lastFeedingTime', 'feedingStatus',
      'stopFeedingReason', 'stopFeedingDetails', 'stopFeedingTimestamp', 'stopFeedingUser', 'fcr',
      'dailyMortalityCount', 'waterTemperature', 'dissolvedOxygen', 'ph', 'ammonia', 'nitrite',
      'lastTelemetryTimestamp', 'sensorQuality', 'activeTreatmentId', 'lastBiometryDate', 'lastTransferDate',
      'criticalAlerts', 'speciesMix', 'manualWaterTemperature', 'lastManualSnapshotAt', 'lastManualSnapshotBy', 'manualSnapshotNotes',
    ];
    if (protectedFields.some((field) => !sameValue(before[field], pond[field]))) return { ok: false, error: 'FARM_STRUCTURE_PROTECTED_POND_FIELD' };
  }

  for (const hall of rows(next, 'halls')) {
    const before = previousHalls.get(hall.id);
    if (!before) {
      if (hall.pondCount !== 0 || hall.totalBiomassKg !== 0 || hall.totalFishCount !== 0) return { ok: false, error: 'NEW_HALL_TOTALS_MUST_START_ZERO' };
      continue;
    }
    // Hall totals are derived from ponds, not manually editable settings.
    for (const field of ['pondCount', 'totalBiomassKg', 'totalFishCount']) {
      const expected = field === 'pondCount'
        ? rows(next, 'ponds').filter((pond) => pond.hallId === hall.id).length
        : field === 'totalFishCount'
          ? rows(next, 'ponds').filter((pond) => pond.hallId === hall.id).reduce((sum, pond) => sum + Number(pond.fishCount || 0), 0)
          : Number(rows(next, 'ponds').filter((pond) => pond.hallId === hall.id).reduce((sum, pond) => sum + Number(pond.biomassKg || 0), 0).toFixed(2));
      if (Number(hall[field]) !== Number(expected)) return { ok: false, error: 'HALL_DERIVED_TOTAL_MISMATCH' };
    }
  }

  for (const item of rows(next, 'species')) {
    const before = previousSpecies.get(item.id);
    if (!before) continue;
    if (before.isActive === false && item.isActive !== false && rows(next, 'ponds').some((pond) => pond.speciesId === item.id && pond.fishCount > 0)) {
      // Re-activation is allowed; this branch only keeps the code path explicit.
      continue;
    }
  }

  const activeHallIds = new Set(rows(next, 'halls').filter((hall) => hall.isActive).map((hall) => hall.id));
  for (const pond of rows(next, 'ponds')) {
    if (pond.fishCount > 0 && !activeHallIds.has(pond.hallId)) return { ok: false, error: 'HALL_WITH_FISH_CANNOT_BE_DEACTIVATED' };
    const item = rows(next, 'species').find((species) => species.id === pond.speciesId);
    if (pond.fishCount > 0 && item?.isActive === false) return { ok: false, error: 'SPECIES_IN_USE_CANNOT_BE_DEACTIVATED' };
  }

  return { ok: true };
}
