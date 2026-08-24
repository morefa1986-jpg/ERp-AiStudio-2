import type { InventoryItem } from '../types';

export const FEED_RAW_MATERIAL_CATEGORY = 'Raw Material (مواد اولیه خوراک)' as const;

export interface FeedFormulaIngredient {
  itemId: string;
  quantityKg: number;
}

export interface FeedFormulaDefinition {
  id: string;
  code: string;
  name: string;
  outputName: string;
  outputSkuBase: string;
  outputUnit: 'kg' | 'gram';
  basisOutputKg: number;
  ingredients: FeedFormulaIngredient[];
  isActive: boolean;
}

export interface FeedProductionInputChange {
  itemId: string;
  quantityChange: number;
  quantityChangeKg: number;
  resultingQuantity: number;
}

export interface FeedProductionPlan {
  ok: boolean;
  error?: string;
  totalInputKg?: number;
  outputKg?: number;
  outputQuantity?: number;
  outputUnit?: 'kg' | 'gram';
  processLossKg?: number;
  currency?: string;
  totalInputValue?: number;
  outputUnitCost?: number;
  inputChanges?: FeedProductionInputChange[];
}

function supportedMassUnit(unit: string): unit is 'kg' | 'gram' {
  return unit === 'kg' || unit === 'gram';
}

export function isFeedFactoryIngredientItem(item: Pick<InventoryItem, 'category' | 'unit'>): boolean {
  const category = String(item.category);
  return supportedMassUnit(item.unit) && (category === 'Feed (خوراک)' || category === FEED_RAW_MATERIAL_CATEGORY);
}

function toKg(item: Pick<InventoryItem, 'unit'>, quantity: number): number {
  if (item.unit === 'kg') return quantity;
  if (item.unit === 'gram') return quantity / 1000;
  return Number.NaN;
}

function fromKg(unit: 'kg' | 'gram', kg: number): number {
  if (unit === 'kg') return kg;
  return kg * 1000;
}

function isExpired(item: InventoryItem, atMs = Date.now()): boolean {
  if (item.status === 'Expired') return true;
  if (!item.expiryDate) return false;
  const expiry = new Date(`${item.expiryDate}T23:59:59.999`).getTime();
  return !Number.isFinite(expiry) || expiry < atMs;
}

export function validateFeedFormula(
  formula: FeedFormulaDefinition,
  inventory: InventoryItem[],
): { ok: boolean; error?: string; totalInputKg?: number; processLossKg?: number } {
  if (
    !formula.code.trim()
    || !formula.name.trim()
    || !formula.outputName.trim()
    || !formula.outputSkuBase.trim()
    || !supportedMassUnit(formula.outputUnit)
    || !Number.isFinite(formula.basisOutputKg)
    || formula.basisOutputKg <= 0
  ) {
    return { ok: false, error: 'FEED_FORMULA_FIELDS_INVALID' };
  }
  if (!Array.isArray(formula.ingredients) || formula.ingredients.length === 0 || formula.ingredients.length > 100) {
    return { ok: false, error: 'FEED_FORMULA_INGREDIENTS_REQUIRED' };
  }
  const ids = formula.ingredients.map((row) => row.itemId);
  if (new Set(ids).size !== ids.length) return { ok: false, error: 'FEED_FORMULA_INGREDIENT_DUPLICATE' };

  let totalInputKg = 0;
  for (const ingredient of formula.ingredients) {
    const item = inventory.find((row) => row.id === ingredient.itemId);
    const qualityHold = Boolean((item as InventoryItem & { qualityHold?: boolean } | undefined)?.qualityHold);
    if (
      !item
      || !isFeedFactoryIngredientItem(item)
      || !Number.isFinite(ingredient.quantityKg)
      || ingredient.quantityKg <= 0
      || isExpired(item)
      || qualityHold
    ) {
      return { ok: false, error: 'FEED_FORMULA_INGREDIENT_INVALID' };
    }
    totalInputKg += ingredient.quantityKg;
  }
  totalInputKg = Number(totalInputKg.toFixed(6));
  if (totalInputKg + 0.0001 < formula.basisOutputKg) return { ok: false, error: 'FEED_FORMULA_MASS_CREATION_FORBIDDEN' };
  const processLossKg = Number((totalInputKg - formula.basisOutputKg).toFixed(6));
  return { ok: true, totalInputKg, processLossKg };
}

export function planFeedProduction(
  formula: FeedFormulaDefinition,
  requestedOutputKg: number,
  inventory: InventoryItem[],
): FeedProductionPlan {
  const validation = validateFeedFormula(formula, inventory);
  if (!validation.ok) return validation;
  if (!formula.isActive) return { ok: false, error: 'FEED_FORMULA_INACTIVE' };
  if (!Number.isFinite(requestedOutputKg) || requestedOutputKg <= 0) return { ok: false, error: 'FEED_PRODUCTION_OUTPUT_INVALID' };

  const scale = requestedOutputKg / formula.basisOutputKg;
  const inputChanges: FeedProductionInputChange[] = [];
  const currencies = new Set<string>();
  let totalInputKg = 0;
  let totalInputValue = 0;

  for (const ingredient of formula.ingredients) {
    const item = inventory.find((row) => row.id === ingredient.itemId)!;
    const requiredKg = Number((ingredient.quantityKg * scale).toFixed(6));
    const currentKg = toKg(item, item.quantity);
    if (!Number.isFinite(currentKg) || currentKg + 0.0001 < requiredKg) {
      return { ok: false, error: `FEED_PRODUCTION_STOCK_INSUFFICIENT:${item.id}` };
    }
    const quantityChange = Number((-fromKg(item.unit as 'kg' | 'gram', requiredKg)).toFixed(6));
    const resultingQuantity = Number((item.quantity + quantityChange).toFixed(6));
    if (resultingQuantity < -0.0001) return { ok: false, error: `FEED_PRODUCTION_STOCK_INSUFFICIENT:${item.id}` };
    if (!item.currency?.trim() || !Number.isFinite(item.purchasePricePerUnit) || item.purchasePricePerUnit < 0) {
      return { ok: false, error: `FEED_PRODUCTION_COST_INVALID:${item.id}` };
    }
    currencies.add(item.currency);
    totalInputKg += requiredKg;
    totalInputValue += Math.abs(quantityChange) * item.purchasePricePerUnit;
    inputChanges.push({
      itemId: item.id,
      quantityChange,
      quantityChangeKg: -requiredKg,
      resultingQuantity: Math.max(0, resultingQuantity),
    });
  }

  if (currencies.size !== 1) return { ok: false, error: 'FEED_PRODUCTION_MIXED_CURRENCY_COST' };
  totalInputKg = Number(totalInputKg.toFixed(6));
  totalInputValue = Number(totalInputValue.toFixed(2));
  const outputQuantity = Number(fromKg(formula.outputUnit, requestedOutputKg).toFixed(6));

  return {
    ok: true,
    totalInputKg,
    outputKg: Number(requestedOutputKg.toFixed(6)),
    outputQuantity,
    outputUnit: formula.outputUnit,
    processLossKg: Number((totalInputKg - requestedOutputKg).toFixed(6)),
    currency: Array.from(currencies)[0],
    totalInputValue,
    outputUnitCost: Number((totalInputValue / outputQuantity).toFixed(6)),
    inputChanges,
  };
}
