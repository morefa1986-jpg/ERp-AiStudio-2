import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '../types';
import { planFeedProduction, validateFeedFormula, type FeedFormulaDefinition } from '../utils/feedFactoryEngine';

const inventory: InventoryItem[] = [
  {
    id: 'raw-a', sku: 'RAW-A', name: 'Ingredient A', category: 'Finished Goods', batchNumber: 'RA-1', quantity: 200, unit: 'kg',
    purchasePricePerUnit: 2, currency: 'USD', supplierName: 'Supplier', warehouseLocation: 'R1', minimumStockThreshold: 10, reorderLevel: 20, status: 'Adequate',
  },
  {
    id: 'raw-b', sku: 'RAW-B', name: 'Ingredient B', category: 'Packaging & Cans', batchNumber: 'RB-1', quantity: 50000, unit: 'gram',
    purchasePricePerUnit: 0.003, currency: 'USD', supplierName: 'Supplier', warehouseLocation: 'R2', minimumStockThreshold: 1000, reorderLevel: 5000, status: 'Adequate',
  },
];

const formula: FeedFormulaDefinition = {
  id: 'f1', code: 'F-001', name: 'User Formula', outputName: 'Finished Feed', outputSkuBase: 'FEED-X', outputUnit: 'kg',
  basisOutputKg: 100, ingredients: [{ itemId: 'raw-a', quantityKg: 80 }, { itemId: 'raw-b', quantityKg: 25 }], isActive: true,
};

describe('feed factory production planning', () => {
  it('scales user-entered formula and conserves mass without requiring ingredient category to be Feed', () => {
    const result = planFeedProduction(formula, 200, inventory);
    expect(result.ok).toBe(true);
    expect(result.totalInputKg).toBe(210);
    expect(result.outputKg).toBe(200);
    expect(result.processLossKg).toBe(10);
    expect(result.inputChanges).toHaveLength(2);
    expect(result.inputChanges?.find((row) => row.itemId === 'raw-a')).toMatchObject({ quantityChange: -160, resultingQuantity: 40 });
    expect(result.inputChanges?.find((row) => row.itemId === 'raw-b')).toMatchObject({ quantityChange: -50000, resultingQuantity: 0 });
    expect(result.currency).toBe('USD');
    expect(result.totalInputValue).toBe(470);
    expect(result.outputUnitCost).toBe(2.35);
  });

  it('rejects formulas that create more output mass than registered input mass', () => {
    const invalid = { ...formula, basisOutputKg: 110 };
    expect(validateFeedFormula(invalid, inventory)).toMatchObject({ ok: false, error: 'FEED_FORMULA_MASS_CREATION_FORBIDDEN' });
  });

  it('fails closed on insufficient raw-material stock', () => {
    const result = planFeedProduction(formula, 250, inventory);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('FEED_PRODUCTION_STOCK_INSUFFICIENT');
  });

  it('fails closed when raw-material costing mixes currencies without an explicit conversion', () => {
    const mixed = inventory.map((item) => item.id === 'raw-b' ? { ...item, currency: 'EUR' } : item);
    expect(planFeedProduction(formula, 100, mixed)).toMatchObject({ ok: false, error: 'FEED_PRODUCTION_MIXED_CURRENCY_COST' });
  });

  it('rejects expired or quality-held ingredients', () => {
    const held = inventory.map((item) => item.id === 'raw-a' ? ({ ...item, qualityHold: true } as InventoryItem & { qualityHold: boolean }) : item);
    expect(validateFeedFormula(formula, held)).toMatchObject({ ok: false, error: 'FEED_FORMULA_INGREDIENT_INVALID' });

    const expired = inventory.map((item) => item.id === 'raw-a' ? { ...item, expiryDate: '2000-01-01' } : item);
    expect(validateFeedFormula(formula, expired)).toMatchObject({ ok: false, error: 'FEED_FORMULA_INGREDIENT_INVALID' });
  });
});
