import type { Pond, PondStockGroup } from '../types';
import type { OperationalStockSex } from '../types/operationalStock';

export interface PondStockSelection {
  speciesId: string;
  sex?: OperationalStockSex;
  count: number;
  biomassKg: number;
  chipNumbers?: string[];
}

export interface PondStockMutationResult {
  ok: boolean;
  error?: string;
  pond?: Pond;
  selectedSex?: OperationalStockSex;
}

function closeEnough(left: number, right: number, tolerance = 0.05): boolean {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
}

function groupBiomass(group: PondStockGroup): number {
  return Number((Number(group.count || 0) * Number(group.averageWeightKg || 0)).toFixed(6));
}

function cleanChips(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((chip) => String(chip || '').trim()).filter(Boolean))];
}

/** Backward-compatible projection: old ponds become Unknown-sex stock groups. */
export function pondStockGroups(pond: Pond): PondStockGroup[] {
  if (Array.isArray(pond.stockGroups) && pond.stockGroups.length) {
    return pond.stockGroups.map((group) => ({
      speciesId: group.speciesId,
      sex: group.sex,
      count: Number(group.count || 0),
      averageWeightKg: Number(group.averageWeightKg || 0),
      chipNumbers: cleanChips(group.chipNumbers),
    }));
  }
  if (Array.isArray(pond.speciesMix) && pond.speciesMix.length) {
    return pond.speciesMix.map((mix) => ({
      speciesId: mix.speciesId,
      sex: 'Unknown',
      count: Number(mix.count || 0),
      averageWeightKg: Number(mix.avgWeightKg || 0),
      chipNumbers: [],
    }));
  }
  if (pond.speciesId && pond.fishCount > 0) {
    return [{
      speciesId: pond.speciesId,
      sex: 'Unknown',
      count: pond.fishCount,
      averageWeightKg: pond.averageWeightKg,
      chipNumbers: [],
    }];
  }
  return [];
}

export function summarizePondStock(pond: Pond, groupsRaw: PondStockGroup[]): Pond {
  const groups = groupsRaw
    .filter((group) => group.count > 0 || cleanChips(group.chipNumbers).length > 0)
    .map((group) => ({ ...group, chipNumbers: cleanChips(group.chipNumbers) }));
  const fishCount = groups.reduce((sum, group) => sum + group.count, 0);
  const biomassKg = Number(groups.reduce((sum, group) => sum + groupBiomass(group), 0).toFixed(3));
  const averageWeightKg = fishCount > 0 ? Number((biomassKg / fishCount).toFixed(4)) : 0;
  const species = new Map<string, { count: number; biomass: number; maleCount: number; femaleCount: number; unknownSexCount: number; chipNumbers: string[] }>();
  for (const group of groups) {
    const current = species.get(group.speciesId) || { count: 0, biomass: 0, maleCount: 0, femaleCount: 0, unknownSexCount: 0, chipNumbers: [] };
    current.count += group.count;
    current.biomass += groupBiomass(group);
    if (group.sex === 'Male') current.maleCount += group.count;
    else if (group.sex === 'Female') current.femaleCount += group.count;
    else current.unknownSexCount += group.count;
    current.chipNumbers = [...current.chipNumbers, ...cleanChips(group.chipNumbers)];
    species.set(group.speciesId, current);
  }
  const speciesMix = [...species.entries()].map(([speciesId, value]) => ({
    speciesId,
    count: value.count,
    avgWeightKg: value.count > 0 ? Number((value.biomass / value.count).toFixed(4)) : 0,
    maleCount: value.maleCount,
    femaleCount: value.femaleCount,
    unknownSexCount: value.unknownSexCount,
    chipNumbers: [...new Set(value.chipNumbers)],
  }));
  return {
    ...pond,
    stockGroups: groups,
    speciesMix,
    speciesId: speciesMix[0]?.speciesId || '',
    fishCount,
    biomassKg,
    averageWeightKg,
  };
}

export function resolvePondStockGroup(
  pond: Pond,
  speciesId: string,
  sex?: OperationalStockSex,
): { ok: boolean; error?: string; index?: number; group?: PondStockGroup; groups?: PondStockGroup[] } {
  const groups = pondStockGroups(pond);
  const candidates = groups.map((group, index) => ({ group, index })).filter(({ group }) => group.speciesId === speciesId && group.count > 0);
  if (!candidates.length) return { ok: false, error: 'STOCK_GROUP_NOT_FOUND' };
  if (sex) {
    const selected = candidates.find(({ group }) => group.sex === sex);
    if (!selected) return { ok: false, error: 'STOCK_GROUP_NOT_FOUND' };
    return { ok: true, ...selected, groups };
  }
  if (candidates.length > 1) return { ok: false, error: 'STOCK_GROUP_SEX_REQUIRED' };
  return { ok: true, ...candidates[0], groups };
}

export function consumePondStock(pond: Pond, selection: PondStockSelection): PondStockMutationResult {
  if (!Number.isInteger(selection.count) || selection.count <= 0 || !Number.isFinite(selection.biomassKg) || selection.biomassKg < 0) {
    return { ok: false, error: 'STOCK_MUTATION_VALUES_INVALID' };
  }
  const resolved = resolvePondStockGroup(pond, selection.speciesId, selection.sex);
  if (!resolved.ok || resolved.index === undefined || !resolved.group || !resolved.groups) return { ok: false, error: resolved.error };
  const group = resolved.group;
  const groupBiomassKg = groupBiomass(group);
  if (selection.count > group.count || selection.biomassKg > groupBiomassKg + 0.05) return { ok: false, error: 'STOCK_GROUP_INSUFFICIENT' };

  const requestedChips = cleanChips(selection.chipNumbers);
  if (requestedChips.length > selection.count) return { ok: false, error: 'STOCK_CHIP_COUNT_INVALID' };
  const existingChips = cleanChips(group.chipNumbers);
  if (requestedChips.some((chip) => !existingChips.includes(chip))) return { ok: false, error: 'STOCK_CHIP_NOT_FOUND' };
  const remainingChips = existingChips.filter((chip) => !requestedChips.includes(chip));
  const remainingCount = group.count - selection.count;
  if (remainingChips.length > remainingCount) return { ok: false, error: 'STOCK_CHIP_SELECTION_REQUIRED' };
  const remainingBiomass = Number(Math.max(0, groupBiomassKg - selection.biomassKg).toFixed(6));
  if (remainingCount === 0 && !closeEnough(remainingBiomass, 0, 0.05)) return { ok: false, error: 'STOCK_GROUP_BIOMASS_REMAINS_WITH_ZERO_COUNT' };

  const groups = resolved.groups.map((row, index) => index === resolved.index ? {
    ...row,
    count: remainingCount,
    averageWeightKg: remainingCount > 0 ? Number((remainingBiomass / remainingCount).toFixed(6)) : 0,
    chipNumbers: remainingChips,
  } : row);
  return { ok: true, pond: summarizePondStock(pond, groups), selectedSex: group.sex };
}

export function addPondStock(pond: Pond, selection: PondStockSelection & { sex: OperationalStockSex }): PondStockMutationResult {
  if (!Number.isInteger(selection.count) || selection.count <= 0 || !Number.isFinite(selection.biomassKg) || selection.biomassKg <= 0) {
    return { ok: false, error: 'STOCK_MUTATION_VALUES_INVALID' };
  }
  const groups = pondStockGroups(pond);
  const requestedChips = cleanChips(selection.chipNumbers);
  if (requestedChips.length > selection.count) return { ok: false, error: 'STOCK_CHIP_COUNT_INVALID' };
  const allExistingChips = new Set(groups.flatMap((group) => cleanChips(group.chipNumbers)));
  if (requestedChips.some((chip) => allExistingChips.has(chip))) return { ok: false, error: 'STOCK_CHIP_DUPLICATE' };
  const index = groups.findIndex((group) => group.speciesId === selection.speciesId && group.sex === selection.sex);
  if (index < 0) {
    groups.push({
      speciesId: selection.speciesId,
      sex: selection.sex,
      count: selection.count,
      averageWeightKg: Number((selection.biomassKg / selection.count).toFixed(6)),
      chipNumbers: requestedChips,
    });
  } else {
    const current = groups[index];
    const nextCount = current.count + selection.count;
    const nextBiomass = groupBiomass(current) + selection.biomassKg;
    groups[index] = {
      ...current,
      count: nextCount,
      averageWeightKg: Number((nextBiomass / nextCount).toFixed(6)),
      chipNumbers: [...cleanChips(current.chipNumbers), ...requestedChips],
    };
  }
  return { ok: true, pond: summarizePondStock(pond, groups), selectedSex: selection.sex };
}

export function pondStockLedgerIsConsistent(pond: Pond): boolean {
  const summarized = summarizePondStock(pond, pondStockGroups(pond));
  return summarized.fishCount === pond.fishCount
    && closeEnough(summarized.biomassKg, pond.biomassKg, 0.05)
    && closeEnough(summarized.averageWeightKg, pond.averageWeightKg, 0.001)
    && JSON.stringify(summarized.speciesMix || []) === JSON.stringify(pond.speciesMix || []);
}
