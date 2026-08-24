import type { InventoryItem } from '../types';

export interface FeedFormulaIngredient {
  itemId: string;
  quantityKg: number;
}

export interface FeedFormulaDefinition {
  id: string;
  code: string;
  name: string;
  outputItemId: string;
  basisOutputKg: number;
  ingredients: FeedFormulaIngredient[];
  isActive: boolean;
}

export interface FeedProductionChange {
  itemId: string;
  quantityChange: number;
  quantityChangeKg: number;
  resultingQuantity: number;
  direction: 'INPUT' | 'OUTPUT';
}

export interface FeedProductionPlan {
  ok: boolean;
  error?: string;
  totalInputKg?: number;
  outputKg?: number;
  processLossKg?: number;
  changes?: FeedProductionChange[];
}

function supportedMassUnit(unit: string): boolean {
  return unit === 'kg' || unit === 'gram';
}

function toKg(item: InventoryItem, quantity: number): number {
  if (item.unit === 'kg') return quantity;
  if (item.unit === 'gram') return quantity / 1000;
  return Number.NaN;
}

function fromKg(item: InventoryItem, kg: number): number {
  if (item.unit === 'kg') return kg;
  if (item.unit === 'gram') return kg * 1000;
  return Number.NaN;
}

export function validateFeedFormula(
  formula: FeedFormulaDefinition,
  inventory: InventoryItem[],
): { ok: boolean; error?: string; totalInputKg?: number; processLossKg?: number } {
  if (!formula.code.trim() || !formula.name.trim() || !Number.isFinite(formula.basisOutputKg) || formula.basisOutputKg <= 0) {
    return { ok: false, error: 'FEED_FORMULA_FIELDS_INVALID' };
  }
  if (!Array.isArray(formula.ingredients) || formula.ingredients.length === 0 || formula.ingredients.length > 100) {
    return { ok: false, error: 'FEED_FORMULA_INGREDIENTS_REQUIRED' };
  }
  const ids = formula.ingredients.map((row) => row.itemId);
  if (new Set(ids).size !== ids.length || ids.includes(formula.outputItemId)) {
    return { ok: false, error: 'FEED_FORMULA_INGREDIENT_DUPLICATE' };
  }
  const output = inventory.find((item) => item.id === formula.outputItemId);
  if (!output || output.category !== 'Feed (خوراک)' || !supportedMassUnit(output.unit)) {
    return { ok: false, error: 'FEED_FORMULA_OUTPUT_INVALID' };
  }
  let totalInputKg = 0;
  for (const ingredient of formula.ingredients) {
    const item = inventory.find((row) => row.id === ingredient.itemId);
    if (!item || item.category !== 'Feed (خوراک)' || !supportedMassUnit(item.unit) || !Number.isFinite(ingredient.quantityKg) || ingredient.quantityKg <= 0) {
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
  const changes: FeedProductionChange[] = [];
  let totalInputKg = 0;
  for (const ingredient of formula.ingredients) {
    const item = inventory.find((row) => row.id === ingredient.itemId)!;
    const requiredKg = Number((ingredient.quantityKg * scale).toFixed(6));
    const currentKg = toKg(item, item.quantity);
    if (!Number.isFinite(currentKg) || currentKg + 0.0001 < requiredKg) return { ok: false, error: `FEED_PRODUCTION_STOCK_INSUFFICIENT:${item.id}` };
    const quantityChange = Number((-fromKg(item, requiredKg)).toFixed(6));
    const resultingQuantity = Number((item.quantity + quantityChange).toFixed(6));
    if (resultingQuantity < -0.0001) return { ok: false, error: `FEED_PRODUCTION_STOCK_INSUFFICIENT:${item.id}` };
    totalInputKg += requiredKg;
    changes.push({ itemId: item.id, quantityChange, quantityChangeKg: -requiredKg, resultingQuantity: Math.max(0, resultingQuantity), direction: 'INPUT' });
  }

  const output = inventory.find((item) => item.id === formula.outputItemId)!;
  const outputQuantityChange = Number(fromKg(output, requestedOutputKg).toFixed(6));
  changes.push({
    itemId: output.id,
    quantityChange: outputQuantityChange,
    quantityChangeKg: requestedOutputKg,
    resultingQuantity: Number((output.quantity + outputQuantityChange).toFixed(6)),
    direction: 'OUTPUT',
  });
  totalInputKg = Number(totalInputKg.toFixed(6));
  return {
    ok: true,
    totalInputKg,
    outputKg: Number(requestedOutputKg.toFixed(6)),
    processLossKg: Number((totalInputKg - requestedOutputKg).toFixed(6)),
    changes,
  };
}
