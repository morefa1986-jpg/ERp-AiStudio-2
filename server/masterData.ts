import crypto from 'crypto';

export type PondShape = 'Rectangular' | 'Circular' | 'Other';
export type StockSex = 'Female' | 'Male' | 'Unknown';

export interface PondStockGroupInput {
  speciesId: string;
  sex: StockSex;
  count: number;
  averageWeightKg: number;
  chipNumbers?: string[];
}

export interface HallMasterInput {
  number: string;
  name: string;
  description?: string;
  managerId?: string;
}

export interface PondMasterInput {
  number: string;
  name: string;
  hallId: string;
  shape: PondShape;
  lengthMeters?: number;
  widthMeters?: number;
  depthMeters?: number;
  diameterMeters?: number;
  capacityCubicMeters?: number;
  stockGroups?: PondStockGroupInput[];
  notes?: string;
}

export interface SpeciesMasterInput {
  faName: string;
  enName: string;
  scientificName: string;
  origin?: string;
  geneticLine?: string;
  description?: string;
  optimumTempMin: number;
  optimumTempMax: number;
  optimumDOMin: number;
  optimumpHMin: number;
  optimumpHMax: number;
  standardFCR: number;
  feedingProfileCoeff: number;
  caviarMaturityYears: number;
}

export interface MasterResult {
  ok: boolean;
  error?: string;
  state?: Record<string, unknown>;
  entity?: Record<string, unknown>;
}

function rows(state: Record<string, unknown>, key: string): any[] {
  return Array.isArray(state[key]) ? state[key] as any[] : [];
}

function text(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function nonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function calculatedCapacity(input: PondMasterInput): number | null {
  if (input.shape === 'Rectangular') {
    if (!positive(input.lengthMeters) || !positive(input.widthMeters) || !positive(input.depthMeters)) return null;
    return Number((input.lengthMeters * input.widthMeters * input.depthMeters).toFixed(3));
  }
  if (input.shape === 'Circular') {
    if (!positive(input.diameterMeters) || !positive(input.depthMeters)) return null;
    return Number((Math.PI * Math.pow(input.diameterMeters / 2, 2) * input.depthMeters).toFixed(3));
  }
  return positive(input.capacityCubicMeters) ? Number(input.capacityCubicMeters.toFixed(3)) : null;
}

function normalizeStockGroups(state: Record<string, unknown>, groupsRaw: unknown): { ok: true; groups: PondStockGroupInput[] } | { ok: false; error: string } {
  if (groupsRaw === undefined) return { ok: true, groups: [] };
  if (!Array.isArray(groupsRaw) || groupsRaw.length > 100) return { ok: false, error: 'POND_STOCK_GROUPS_INVALID' };
  const speciesIds = new Set(rows(state, 'species').map((row) => String(row?.id || '')));
  const seenChips = new Set<string>();
  for (const pond of rows(state, 'ponds')) {
    for (const group of Array.isArray(pond?.stockGroups) ? pond.stockGroups : []) {
      for (const chip of Array.isArray(group?.chipNumbers) ? group.chipNumbers : []) seenChips.add(String(chip));
    }
  }
  const groups: PondStockGroupInput[] = [];
  for (const raw of groupsRaw) {
    const speciesId = text(raw?.speciesId, 128);
    const sex = raw?.sex;
    const count = Number(raw?.count);
    const averageWeightKg = Number(raw?.averageWeightKg);
    const chips = Array.isArray(raw?.chipNumbers)
      ? [...new Set(raw.chipNumbers.map((chip: unknown) => text(chip, 128)).filter(Boolean))]
      : [];
    if (!speciesId || !speciesIds.has(speciesId)) return { ok: false, error: 'POND_STOCK_SPECIES_INVALID' };
    if (!['Female', 'Male', 'Unknown'].includes(sex)) return { ok: false, error: 'POND_STOCK_SEX_INVALID' };
    if (!Number.isInteger(count) || count < 0 || !nonNegative(averageWeightKg)) return { ok: false, error: 'POND_STOCK_COUNT_WEIGHT_INVALID' };
    if (chips.length > count) return { ok: false, error: 'POND_STOCK_CHIP_COUNT_INVALID' };
    for (const chip of chips) {
      if (seenChips.has(chip)) return { ok: false, error: 'POND_STOCK_CHIP_DUPLICATE' };
      seenChips.add(chip);
    }
    groups.push({ speciesId, sex, count, averageWeightKg, chipNumbers: chips });
  }
  return { ok: true, groups };
}

function stockSummary(groups: PondStockGroupInput[]) {
  const fishCount = groups.reduce((sum, group) => sum + group.count, 0);
  const biomassKg = Number(groups.reduce((sum, group) => sum + group.count * group.averageWeightKg, 0).toFixed(3));
  const averageWeightKg = fishCount > 0 ? Number((biomassKg / fishCount).toFixed(4)) : 0;
  const speciesMap = new Map<string, { count: number; biomass: number }>();
  for (const group of groups) {
    const current = speciesMap.get(group.speciesId) || { count: 0, biomass: 0 };
    current.count += group.count;
    current.biomass += group.count * group.averageWeightKg;
    speciesMap.set(group.speciesId, current);
  }
  const speciesMix = [...speciesMap.entries()].map(([speciesId, value]) => ({
    speciesId,
    count: value.count,
    avgWeightKg: value.count > 0 ? Number((value.biomass / value.count).toFixed(4)) : 0,
  }));
  return { fishCount, biomassKg, averageWeightKg, speciesMix, primarySpeciesId: speciesMix[0]?.speciesId || '' };
}

export function createHallMaster(state: Record<string, unknown>, raw: HallMasterInput): MasterResult {
  const number = text(raw?.number, 64);
  const name = text(raw?.name, 160);
  if (!number || !name) return { ok: false, error: 'HALL_NUMBER_NAME_REQUIRED' };
  const halls = rows(state, 'halls');
  if (halls.some((hall) => String(hall?.number).toLowerCase() === number.toLowerCase())) return { ok: false, error: 'HALL_NUMBER_DUPLICATE' };
  const hall = {
    id: `hall_${crypto.randomUUID()}`,
    number,
    name,
    description: text(raw?.description, 1000),
    pondCount: 0,
    totalBiomassKg: 0,
    totalFishCount: 0,
    managerId: text(raw?.managerId, 128) || undefined,
    isActive: true,
  };
  return { ok: true, entity: hall, state: { ...state, halls: [hall, ...halls] } };
}

export function updateHallMaster(state: Record<string, unknown>, hallId: string, raw: Partial<HallMasterInput> & { isActive?: boolean }): MasterResult {
  const halls = rows(state, 'halls');
  const existing = halls.find((hall) => hall?.id === hallId);
  if (!existing) return { ok: false, error: 'HALL_NOT_FOUND' };
  const number = raw.number === undefined ? existing.number : text(raw.number, 64);
  const name = raw.name === undefined ? existing.name : text(raw.name, 160);
  if (!number || !name) return { ok: false, error: 'HALL_NUMBER_NAME_REQUIRED' };
  if (halls.some((hall) => hall?.id !== hallId && String(hall?.number).toLowerCase() === String(number).toLowerCase())) return { ok: false, error: 'HALL_NUMBER_DUPLICATE' };
  const updated = {
    ...existing,
    number,
    name,
    description: raw.description === undefined ? existing.description : text(raw.description, 1000),
    managerId: raw.managerId === undefined ? existing.managerId : text(raw.managerId, 128) || undefined,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : existing.isActive,
  };
  return { ok: true, entity: updated, state: { ...state, halls: halls.map((hall) => hall?.id === hallId ? updated : hall) } };
}

export function createPondMaster(state: Record<string, unknown>, raw: PondMasterInput): MasterResult {
  const hallId = text(raw?.hallId, 128);
  const number = text(raw?.number, 64);
  const name = text(raw?.name, 160);
  if (!hallId || !number || !name) return { ok: false, error: 'POND_HALL_NUMBER_NAME_REQUIRED' };
  if (!rows(state, 'halls').some((hall) => hall?.id === hallId && hall?.isActive !== false)) return { ok: false, error: 'POND_HALL_INVALID' };
  const shape = raw?.shape;
  if (!['Rectangular', 'Circular', 'Other'].includes(shape)) return { ok: false, error: 'POND_SHAPE_INVALID' };
  const capacity = calculatedCapacity(raw);
  if (!capacity) return { ok: false, error: 'POND_DIMENSIONS_INVALID' };
  const ponds = rows(state, 'ponds');
  if (ponds.some((pond) => pond?.hallId === hallId && String(pond?.number).toLowerCase() === number.toLowerCase())) return { ok: false, error: 'POND_NUMBER_DUPLICATE_IN_HALL' };
  const stock = normalizeStockGroups(state, raw.stockGroups);
  if (!stock.ok) return stock;
  const summary = stockSummary(stock.groups);
  const pond = {
    id: `pond_${crypto.randomUUID()}`,
    number,
    name,
    hallId,
    shape,
    lengthMeters: shape === 'Rectangular' ? Number(raw.lengthMeters) : undefined,
    widthMeters: shape === 'Rectangular' ? Number(raw.widthMeters) : undefined,
    depthMeters: shape !== 'Other' ? Number(raw.depthMeters) : undefined,
    diameterMeters: shape === 'Circular' ? Number(raw.diameterMeters) : undefined,
    capacityCubicMeters: capacity,
    fishCount: summary.fishCount,
    speciesId: summary.primarySpeciesId,
    speciesMix: summary.speciesMix,
    stockGroups: stock.groups,
    biomassKg: summary.biomassKg,
    averageWeightKg: summary.averageWeightKg,
    lastFeedingKg: 0,
    lastFeedingTime: '',
    feedingStatus: 'STOPPED',
    stopFeedingReason: 'Manual Decision',
    stopFeedingDetails: 'استخر جدید؛ خوراک تا ثبت و تأیید شرایط عملیاتی متوقف است.',
    stopFeedingTimestamp: new Date().toISOString(),
    fcr: 0,
    dailyMortalityCount: 0,
    waterTemperature: 0,
    dissolvedOxygen: 0,
    ph: 0,
    sensorQuality: 'OFFLINE',
    lastBiometryDate: '',
    criticalAlerts: [],
    notes: text(raw?.notes, 2000),
    isActive: true,
  };
  return { ok: true, entity: pond, state: { ...state, ponds: [pond, ...ponds] } };
}

export function updatePondMetadata(state: Record<string, unknown>, pondId: string, raw: Partial<PondMasterInput> & { isActive?: boolean }): MasterResult {
  const ponds = rows(state, 'ponds');
  const existing = ponds.find((pond) => pond?.id === pondId);
  if (!existing) return { ok: false, error: 'POND_NOT_FOUND' };
  const hallId = raw.hallId === undefined ? existing.hallId : text(raw.hallId, 128);
  if (!rows(state, 'halls').some((hall) => hall?.id === hallId)) return { ok: false, error: 'POND_HALL_INVALID' };
  const number = raw.number === undefined ? existing.number : text(raw.number, 64);
  const name = raw.name === undefined ? existing.name : text(raw.name, 160);
  if (!number || !name) return { ok: false, error: 'POND_NUMBER_NAME_REQUIRED' };
  if (ponds.some((pond) => pond?.id !== pondId && pond?.hallId === hallId && String(pond?.number).toLowerCase() === String(number).toLowerCase())) return { ok: false, error: 'POND_NUMBER_DUPLICATE_IN_HALL' };
  const shape = (raw.shape || existing.shape || 'Other') as PondShape;
  const dimensions: PondMasterInput = {
    number, name, hallId, shape,
    lengthMeters: raw.lengthMeters ?? existing.lengthMeters,
    widthMeters: raw.widthMeters ?? existing.widthMeters,
    depthMeters: raw.depthMeters ?? existing.depthMeters,
    diameterMeters: raw.diameterMeters ?? existing.diameterMeters,
    capacityCubicMeters: raw.capacityCubicMeters ?? existing.capacityCubicMeters,
  };
  const capacity = calculatedCapacity(dimensions);
  if (!capacity) return { ok: false, error: 'POND_DIMENSIONS_INVALID' };
  const updated = {
    ...existing,
    hallId,
    number,
    name,
    shape,
    lengthMeters: shape === 'Rectangular' ? dimensions.lengthMeters : undefined,
    widthMeters: shape === 'Rectangular' ? dimensions.widthMeters : undefined,
    depthMeters: shape !== 'Other' ? dimensions.depthMeters : undefined,
    diameterMeters: shape === 'Circular' ? dimensions.diameterMeters : undefined,
    capacityCubicMeters: capacity,
    notes: raw.notes === undefined ? existing.notes : text(raw.notes, 2000),
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : existing.isActive !== false,
  };
  return { ok: true, entity: updated, state: { ...state, ponds: ponds.map((pond) => pond?.id === pondId ? updated : pond) } };
}

export function createSpeciesMaster(state: Record<string, unknown>, raw: SpeciesMasterInput): MasterResult {
  const faName = text(raw?.faName, 160);
  const enName = text(raw?.enName, 160);
  const scientificName = text(raw?.scientificName, 200);
  if (!faName || !enName || !scientificName) return { ok: false, error: 'SPECIES_NAMES_REQUIRED' };
  const species = rows(state, 'species');
  if (species.some((row) => String(row?.scientificName).toLowerCase() === scientificName.toLowerCase())) return { ok: false, error: 'SPECIES_DUPLICATE' };
  const numeric = [raw.optimumTempMin, raw.optimumTempMax, raw.optimumDOMin, raw.optimumpHMin, raw.optimumpHMax, raw.standardFCR, raw.feedingProfileCoeff, raw.caviarMaturityYears];
  if (numeric.some((value) => !nonNegative(value)) || raw.optimumTempMax <= raw.optimumTempMin || raw.optimumpHMax <= raw.optimumpHMin) return { ok: false, error: 'SPECIES_LIMITS_INVALID' };
  const entity = {
    id: `sp_${crypto.randomUUID()}`,
    faName,
    enName,
    scientificName,
    origin: text(raw.origin, 300),
    geneticLine: text(raw.geneticLine, 300),
    description: text(raw.description, 1500),
    optimumTempMin: raw.optimumTempMin,
    optimumTempMax: raw.optimumTempMax,
    optimumDOMin: raw.optimumDOMin,
    optimumpHMin: raw.optimumpHMin,
    optimumpHMax: raw.optimumpHMax,
    standardFCR: raw.standardFCR,
    feedingProfileCoeff: raw.feedingProfileCoeff,
    caviarMaturityYears: raw.caviarMaturityYears,
    isActive: true,
  };
  return { ok: true, entity, state: { ...state, species: [entity, ...species] } };
}
