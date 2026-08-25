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
  const speciesIds = new Set(rows(state, 'species').filter((row) => row?.isActive !== false).map((row) => String(row?.id || '')));
  const seenChips = new Set<string>();
  for (const pond of rows(state, 'ponds')) {
    for (const group of Array.isArray(pond?.stockGroups) ? pond.stockGroups : []) {
      for (const chip of Array.isArray(group?.chipNumbers) ? group.chipNumbers : []) seenChips.add(String(chip));
    }
  }
  const groups: PondStockGroupInput[] = [];
  for (const raw of groupsRaw) {
    const speciesId = text(raw?.speciesId, 128);
    const sexRaw = String(raw?.sex || '');
    const count = Number(raw?.count);
    const averageWeightKg = Number(raw?.averageWeightKg);
    const chips: string[] = Array.isArray(raw?.chipNumbers)
      ? [...new Set<string>(raw.chipNumbers.map((chip: unknown) => text(chip, 128)).filter((chip: string) => chip.length > 0))]
      : [];
    if (!speciesId || !speciesIds.has(speciesId)) return { ok: false, error: 'POND_STOCK_SPECIES_INVALID' };
    if (!['Female', 'Male', 'Unknown'].includes(sexRaw)) return { ok: false, error: 'POND_STOCK_SEX_INVALID' };
    if (!Number.isInteger(count) || count < 0 || !nonNegative(averageWeightKg)) return { ok: false, error: 'POND_STOCK_COUNT_WEIGHT_INVALID' };
    if (chips.length > count) return { ok: false, error: 'POND_STOCK_CHIP_COUNT_INVALID' };
    for (const chip of chips) {
      if (seenChips.has(chip)) return { ok: false, error: 'POND_STOCK_CHIP_DUPLICATE' };
      seenChips.add(chip);
    }
    groups.push({ speciesId, sex: sexRaw as StockSex, count, averageWeightKg, chipNumbers: chips });
  }
  return { ok: true, groups };
}

function stockSummary(groups: PondStockGroupInput[]) {
  const fishCount = groups.reduce((sum, group) => sum + group.count, 0);
  const biomassKg = Number(groups.reduce((sum, group) => sum + group.count * group.averageWeightKg, 0).toFixed(3));
  const averageWeightKg = fishCount > 0 ? Number((biomassKg / fishCount).toFixed(4)) : 0;
  const speciesMap = new Map<string, { count: number; biomass: number; maleCount: number; femaleCount: number; unknownSexCount: number; chipNumbers: string[] }>();
  for (const group of groups) {
    const current = speciesMap.get(group.speciesId) || { count: 0, biomass: 0, maleCount: 0, femaleCount: 0, unknownSexCount: 0, chipNumbers: [] };
    current.count += group.count;
    current.biomass += group.count * group.averageWeightKg;
    if (group.sex === 'Male') current.maleCount += group.count;
    else if (group.sex === 'Female') current.femaleCount += group.count;
    else current.unknownSexCount += group.count;
    current.chipNumbers = [...current.chipNumbers, ...(group.chipNumbers || [])];
    speciesMap.set(group.speciesId, current);
  }
  const speciesMix = [...speciesMap.entries()].map(([speciesId, value]) => ({
    speciesId,
    count: value.count,
    avgWeightKg: value.count > 0 ? Number((value.biomass / value.count).toFixed(4)) : 0,
    maleCount: value.maleCount,
    femaleCount: value.femaleCount,
    unknownSexCount: value.unknownSexCount,
    chipNumbers: [...new Set(value.chipNumbers)],
  }));
  return { fishCount, biomassKg, averageWeightKg, speciesMix, primarySpeciesId: speciesMix[0]?.speciesId || '' };
}

function speciesInActiveUse(state: Record<string, unknown>, speciesId: string): boolean {
  const pondUse = rows(state, 'ponds').some((pond) => {
    if (pond?.isActive === false) return false;
    if (pond?.speciesId === speciesId && Number(pond?.fishCount || 0) > 0) return true;
    if (Array.isArray(pond?.speciesMix) && pond.speciesMix.some((mix: any) => mix?.speciesId === speciesId && Number(mix?.count || 0) > 0)) return true;
    return Array.isArray(pond?.stockGroups) && pond.stockGroups.some((group: any) => group?.speciesId === speciesId && Number(group?.count || 0) > 0);
  });
  if (pondUse) return true;
  if (rows(state, 'broodstock').some((fish) => fish?.speciesId === speciesId && fish?.status !== 'Retired')) return true;
  if (rows(state, 'larvae').some((batch) => batch?.speciesId === speciesId && batch?.status !== 'Graduated')) return true;
  if (rows(state, 'nurseryTanks').some((tank) => tank?.speciesId === speciesId && Number(tank?.fishCount || 0) > 0)) return true;
  return false;
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
  if (raw.isActive === false && rows(state, 'ponds').some((pond) => pond?.hallId === hallId && pond?.isActive !== false)) {
    return { ok: false, error: 'HALL_HAS_ACTIVE_PONDS' };
  }
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
  if (stock.ok === false) return stock;
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
  if (raw.stockGroups !== undefined) return { ok: false, error: 'POND_STOCK_MUTATION_REQUIRES_OPERATIONAL_WORKFLOW' };
  if (raw.isActive === false) {
    const hasStock = Number(existing.fishCount || 0) > 0 || Number(existing.biomassKg || 0) > 0;
    const hasActiveTreatment = Boolean(existing.activeTreatmentId) || rows(state, 'treatments').some((treatment) => treatment?.pondId === pondId && treatment?.status === 'ACTIVE');
    if (hasStock) return { ok: false, error: 'POND_DEACTIVATION_REQUIRES_EMPTY_STOCK' };
    if (hasActiveTreatment) return { ok: false, error: 'POND_DEACTIVATION_ACTIVE_TREATMENT' };
  }
  const hallId = raw.hallId === undefined ? existing.hallId : text(raw.hallId, 128);
  const targetHall = rows(state, 'halls').find((hall) => hall?.id === hallId);
  if (!targetHall) return { ok: false, error: 'POND_HALL_INVALID' };
  if (raw.hallId !== undefined && targetHall.isActive === false) return { ok: false, error: 'POND_HALL_INACTIVE' };
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

export function updateSpeciesMaster(state: Record<string, unknown>, speciesId: string, raw: Partial<SpeciesMasterInput> & { isActive?: boolean }): MasterResult {
  const species = rows(state, 'species');
  const existing = species.find((row) => row?.id === speciesId);
  if (!existing) return { ok: false, error: 'SPECIES_NOT_FOUND' };
  if (raw.isActive === false && speciesInActiveUse(state, speciesId)) return { ok: false, error: 'SPECIES_IN_ACTIVE_USE' };

  const faName = raw.faName === undefined ? existing.faName : text(raw.faName, 160);
  const enName = raw.enName === undefined ? existing.enName : text(raw.enName, 160);
  const scientificName = raw.scientificName === undefined ? existing.scientificName : text(raw.scientificName, 200);
  if (!faName || !enName || !scientificName) return { ok: false, error: 'SPECIES_NAMES_REQUIRED' };
  if (species.some((row) => row?.id !== speciesId && String(row?.scientificName).toLowerCase() === String(scientificName).toLowerCase())) return { ok: false, error: 'SPECIES_DUPLICATE' };

  const optimumTempMin = raw.optimumTempMin ?? existing.optimumTempMin;
  const optimumTempMax = raw.optimumTempMax ?? existing.optimumTempMax;
  const optimumDOMin = raw.optimumDOMin ?? existing.optimumDOMin;
  const optimumpHMin = raw.optimumpHMin ?? existing.optimumpHMin;
  const optimumpHMax = raw.optimumpHMax ?? existing.optimumpHMax;
  const standardFCR = raw.standardFCR ?? existing.standardFCR;
  const feedingProfileCoeff = raw.feedingProfileCoeff ?? existing.feedingProfileCoeff;
  const caviarMaturityYears = raw.caviarMaturityYears ?? existing.caviarMaturityYears;
  const numeric = [optimumTempMin, optimumTempMax, optimumDOMin, optimumpHMin, optimumpHMax, standardFCR, feedingProfileCoeff, caviarMaturityYears];
  if (numeric.some((value) => !nonNegative(value)) || optimumTempMax <= optimumTempMin || optimumpHMax <= optimumpHMin) return { ok: false, error: 'SPECIES_LIMITS_INVALID' };

  const updated = {
    ...existing,
    faName,
    enName,
    scientificName,
    origin: raw.origin === undefined ? existing.origin : text(raw.origin, 300),
    geneticLine: raw.geneticLine === undefined ? existing.geneticLine : text(raw.geneticLine, 300),
    description: raw.description === undefined ? existing.description : text(raw.description, 1500),
    optimumTempMin,
    optimumTempMax,
    optimumDOMin,
    optimumpHMin,
    optimumpHMax,
    standardFCR,
    feedingProfileCoeff,
    caviarMaturityYears,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : existing.isActive !== false,
  };
  return { ok: true, entity: updated, state: { ...state, species: species.map((row) => row?.id === speciesId ? updated : row) } };
}
