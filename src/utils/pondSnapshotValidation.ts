type State = Record<string, any>;

type Operation = { module?: string; action?: string };

const finiteNonNegative = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const sameValue = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const nearlyEqual = (left: unknown, right: unknown, tolerance = 0.05): boolean => {
  const a = Number(left);
  const b = Number(right);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
};

function rows(state: State, key: string): any[] {
  return Array.isArray(state[key]) ? state[key] : [];
}

function positiveIfPresent(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0);
}

function validateDimensions(pond: any): { ok: boolean; error?: string } {
  if (!positiveIfPresent(pond.lengthMeters) || !positiveIfPresent(pond.widthMeters) || !positiveIfPresent(pond.depthMeters) || !positiveIfPresent(pond.diameterMeters)) {
    return { ok: false, error: 'POND_DIMENSIONS_INVALID' };
  }

  if (pond.pondShape === 'Circular') {
    if (!finiteNonNegative(pond.diameterMeters) || pond.diameterMeters <= 0 || !finiteNonNegative(pond.depthMeters) || pond.depthMeters <= 0) {
      return { ok: false, error: 'POND_CIRCULAR_DIMENSIONS_REQUIRED' };
    }
    const expectedCapacity = Math.PI * Math.pow(pond.diameterMeters / 2, 2) * pond.depthMeters;
    if (!nearlyEqual(pond.capacityCubicMeters, expectedCapacity, 0.1)) return { ok: false, error: 'POND_CAPACITY_DIMENSION_MISMATCH' };
  }

  if (pond.pondShape === 'Rectangular' || pond.pondShape === 'Raceway') {
    if (!finiteNonNegative(pond.lengthMeters) || pond.lengthMeters <= 0 || !finiteNonNegative(pond.widthMeters) || pond.widthMeters <= 0 || !finiteNonNegative(pond.depthMeters) || pond.depthMeters <= 0) {
      return { ok: false, error: 'POND_RECTANGULAR_DIMENSIONS_REQUIRED' };
    }
    const expectedCapacity = pond.lengthMeters * pond.widthMeters * pond.depthMeters;
    if (!nearlyEqual(pond.capacityCubicMeters, expectedCapacity, 0.1)) return { ok: false, error: 'POND_CAPACITY_DIMENSION_MISMATCH' };
  }

  return { ok: true };
}

function validateSpeciesMix(pond: any, speciesIds: Set<string>): { ok: boolean; error?: string } {
  const groups = Array.isArray(pond.speciesMix) ? pond.speciesMix : [];
  if (pond.fishCount > 0 && groups.length === 0) return { ok: false, error: 'POND_SPECIES_MIX_REQUIRED' };
  if (groups.length === 0) return { ok: true };

  let totalCount = 0;
  let totalBiomass = 0;
  const seenSpecies = new Set<string>();
  const seenChips = new Set<string>();

  for (const group of groups) {
    if (!group || typeof group.speciesId !== 'string' || !speciesIds.has(group.speciesId) || seenSpecies.has(group.speciesId)) {
      return { ok: false, error: 'POND_SPECIES_GROUP_INVALID' };
    }
    seenSpecies.add(group.speciesId);

    if (!Number.isInteger(group.count) || group.count < 0 || !finiteNonNegative(group.avgWeightKg)) {
      return { ok: false, error: 'POND_SPECIES_GROUP_BIOMETRY_INVALID' };
    }

    const male = Number(group.maleCount);
    const female = Number(group.femaleCount);
    const unknown = Number(group.unknownSexCount);
    if (![male, female, unknown].every((value) => Number.isInteger(value) && value >= 0) || male + female + unknown !== group.count) {
      return { ok: false, error: 'POND_SEX_TOTAL_MISMATCH' };
    }

    const chips = Array.isArray(group.chipNumbers) ? group.chipNumbers : [];
    if (chips.length > group.count) return { ok: false, error: 'POND_CHIP_COUNT_INVALID' };
    for (const rawChip of chips) {
      const chip = typeof rawChip === 'string' ? rawChip.trim() : '';
      if (!chip || seenChips.has(chip)) return { ok: false, error: 'POND_CHIP_DUPLICATE_OR_INVALID' };
      seenChips.add(chip);
    }

    totalCount += group.count;
    totalBiomass += group.count * group.avgWeightKg;
  }

  if (totalCount !== pond.fishCount) return { ok: false, error: 'POND_SPECIES_COUNT_MISMATCH' };
  const calculatedBiomass = Number(totalBiomass.toFixed(2));
  const calculatedAverage = totalCount > 0 ? Number((totalBiomass / totalCount).toFixed(3)) : 0;
  if (!nearlyEqual(pond.biomassKg, calculatedBiomass, 0.05) || !nearlyEqual(pond.averageWeightKg, calculatedAverage, 0.001)) {
    return { ok: false, error: 'POND_MANUAL_BIOMASS_MISMATCH' };
  }
  if (pond.speciesId !== groups[0].speciesId) return { ok: false, error: 'POND_PRIMARY_SPECIES_MISMATCH' };
  return { ok: true };
}

export function validateManualPondSnapshotMutation(
  previous: State,
  next: State,
  operation: Operation,
): { ok: boolean; error?: string } {
  if (operation.module !== 'ponds' || operation.action !== 'edit') return { ok: false, error: 'POND_MANUAL_OPERATION_INVALID' };

  const beforeById = new Map(rows(previous, 'ponds').map((pond) => [pond?.id, pond]));
  const changed = rows(next, 'ponds').filter((pond) => pond?.id && beforeById.has(pond.id) && !sameValue(beforeById.get(pond.id), pond));
  if (!changed.length) return { ok: false, error: 'POND_MANUAL_NO_CHANGE' };
  if (rows(next, 'ponds').some((pond) => pond?.id && !beforeById.has(pond.id))) return { ok: false, error: 'POND_CREATION_REQUIRES_SETTINGS' };

  const speciesIds = new Set(rows(next, 'species').map((species) => species?.id).filter(Boolean));
  for (const pond of changed) {
    const before = beforeById.get(pond.id);
    if (!before) return { ok: false, error: 'POND_NOT_FOUND' };
    if (before.feedingStatus === 'STOPPED' && pond.feedingStatus === 'ACTIVE') return { ok: false, error: 'FEEDING_RESUME_REQUIRES_APPROVAL' };

    if (!Number.isInteger(pond.fishCount) || pond.fishCount < 0 || !finiteNonNegative(pond.biomassKg) || !finiteNonNegative(pond.averageWeightKg)) {
      return { ok: false, error: 'POND_MANUAL_BIOMETRY_INVALID' };
    }
    if (typeof pond.manualWaterTemperature !== 'number' || !Number.isFinite(pond.manualWaterTemperature) || pond.manualWaterTemperature < 0 || pond.manualWaterTemperature > 40) {
      return { ok: false, error: 'POND_MANUAL_TEMPERATURE_INVALID' };
    }
    if (typeof pond.lastManualSnapshotAt !== 'string' || Number.isNaN(new Date(pond.lastManualSnapshotAt).getTime()) || typeof pond.lastManualSnapshotBy !== 'string' || !pond.lastManualSnapshotBy.trim()) {
      return { ok: false, error: 'POND_MANUAL_AUDIT_FIELDS_REQUIRED' };
    }
    if (typeof pond.manualSnapshotNotes !== 'string' || pond.manualSnapshotNotes.trim().length < 3) {
      return { ok: false, error: 'POND_MANUAL_REASON_REQUIRED' };
    }

    const dimensions = validateDimensions(pond);
    if (!dimensions.ok) return dimensions;
    const mix = validateSpeciesMix(pond, speciesIds);
    if (!mix.ok) return mix;
  }

  return { ok: true };
}
