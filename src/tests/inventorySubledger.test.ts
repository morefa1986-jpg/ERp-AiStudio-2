import { describe, expect, it } from 'vitest';
import { applyInventoryIssues } from '../utils/inventorySubledger';

const item = (patch: Record<string, unknown> = {}) => ({
  id: 'inv_1', sku: 'SPARE-001', name: 'Pump Seal', category: 'Equipment & Spare Parts', batchNumber: 'B1', quantity: 10, unit: 'piece',
  purchasePricePerUnit: 100, currency: 'IRR', supplierName: 'Supplier', warehouseLocation: 'Main', status: 'Adequate',
  minimumStockThreshold: 0, reorderLevel: 0,
  ...patch,
} as any);

describe('inventory subledger issues', () => {
  it('issues maintenance parts from warehouse with an auditable transaction', () => {
    const result = applyInventoryIssues([item()], [{ itemId: 'inv_1', quantity: 2, unit: 'piece', reason: 'Maintenance WO completion', referenceType: 'Maintenance', referenceId: 'wo_1', performedBy: 'Manager', timestamp: '2026-08-24T10:00:00Z' }]);
    expect(result.ok).toBe(true);
    expect(result.inventory?.[0].quantity).toBe(8);
    expect(result.transactions?.[0]).toMatchObject({
      itemId: 'inv_1',
      sku: 'SPARE-001',
      type: 'Consumption (مصرف روزانه)',
      quantityChange: -2,
      resultingQuantity: 8,
      referenceDoc: 'Maintenance:wo_1',
      operator: 'Manager',
      notes: 'Maintenance WO completion',
      totalValue: 200,
    });
  });

  it('issues medicine lots from warehouse without allowing expired, held, or insufficient stock', () => {
    expect(applyInventoryIssues([item({ category: 'Medicine & Disinfectant (دارو و ضدعفونی)', quantity: 3 })], [{ itemId: 'inv_1', quantity: 1, unit: 'piece', reason: 'Treatment administration ledger', referenceType: 'Treatment', referenceId: 'treat_1', performedBy: 'Vet' }]).ok).toBe(true);
    expect(applyInventoryIssues([item({ quantity: 0 })], [{ itemId: 'inv_1', quantity: 1, unit: 'piece', reason: 'No stock', referenceType: 'Maintenance', referenceId: 'wo_2', performedBy: 'Manager' }]).error).toBe('INVENTORY_ISSUE_STOCK_INSUFFICIENT');
    expect(applyInventoryIssues([item({ status: 'Expired' })], [{ itemId: 'inv_1', quantity: 1, unit: 'piece', reason: 'Expired', referenceType: 'Treatment', referenceId: 'treat_2', performedBy: 'Vet' }]).error).toBe('INVENTORY_ISSUE_EXPIRED_FORBIDDEN');
    expect(applyInventoryIssues([item({ qualityHold: true })], [{ itemId: 'inv_1', quantity: 1, unit: 'piece', reason: 'Hold', referenceType: 'Maintenance', referenceId: 'wo_3', performedBy: 'Manager' }]).error).toBe('INVENTORY_ISSUE_QUALITY_HOLD_FORBIDDEN');
  });
});
