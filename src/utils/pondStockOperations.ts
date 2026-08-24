import type { Pond } from '../types';
import type { OperationalStockSex } from '../types/operationalStock';
import { consumePondStock, pondStockGroups, resolvePondStockGroup, summarizePondStock } from './pondStockLedger';

export interface MortalityStockInput {
  speciesId: string;
  stockSex?: OperationalStockSex;
  count: number;
  biomassKg: number;
  chipNumbers?: string[];
}

export interface BiometryStockInput {
  speciesId: string;
  stockSex?: OperationalStockSex;
  averageWeightKg: number;
  date: string;
}

export interface PondStockOperationResult {
  ok: boolean;
  error?: string;
  pond?: Pond;
  selectedSex?: OperationalStockSex;
  selectedCount?: number;
  previousAverageWeightKg?: number;
}

export function applyMortalityToPondStock(pond: Pond, input: MortalityStockInput): PondStockOperationResult {
  if (!Number.isInteger(input.count) || input.count <= 0 || !Number.isFinite(input.biomassKg) || input.biomassKg < 0) {
    return { ok: false, error: 'MORTALITY_STOCK_VALUES_INVALID' };
  }
  const resolved = resolvePondStockGroup(pond, input.speciesId, input.stockSex);
  if (!resolved.ok || !resolved.group) return { ok: false, error: resolved.error || 'MORTALITY_STOCK_GROUP_NOT_FOUND' };
  const consumed = consumePondStock(pond, {
    speciesId: input.speciesId,
    sex: resolved.group.sex,
    count: input.count,
    biomassKg: input.biomassKg,
    chipNumbers: input.chipNumbers,
  });
  if (!consumed.ok || !consumed.pond) return { ok: false, error: consumed.error || 'MORTALITY_STOCK_CONSERVATION_FAILED' };
  return {
    ok: true,
    selectedSex: resolved.group.sex,
    selectedCount: resolved.group.count,
    pond: { ...consumed.pond, dailyMortalityCount: Number(pond.dailyMortalityCount || 0) + input.count },
  };
}

export function applyBiometryToPondStock(pond: Pond, input: BiometryStockInput): PondStockOperationResult {
  if (!Number.isFinite(input.averageWeightKg) || input.averageWeightKg <= 0 || !input.date?.trim()) {
    return { ok: false, error: 'BIOMETRY_STOCK_VALUES_INVALID' };
  }
  const resolved = resolvePondStockGroup(pond, input.speciesId, input.stockSex);
  if (!resolved.ok || resolved.index === undefined || !resolved.group || !resolved.groups) {
    return { ok: false, error: resolved.error || 'BIOMETRY_STOCK_GROUP_NOT_FOUND' };
  }
  const groups = resolved.groups.map((group, index) => index === resolved.index
    ? { ...group, averageWeightKg: Number(input.averageWeightKg.toFixed(6)) }
    : group);
  const summarized = summarizePondStock(pond, groups);
  return {
    ok: true,
    pond: { ...summarized, lastBiometryDate: input.date },
    selectedSex: resolved.group.sex,
    selectedCount: resolved.group.count,
    previousAverageWeightKg: resolved.group.averageWeightKg,
  };
}

export function pondStockSelectionRequired(pond: Pond, speciesId?: string): boolean {
  if (!speciesId) return false;
  return pondStockGroups(pond).filter((group) => group.speciesId === speciesId && group.count > 0).length > 1;
}
