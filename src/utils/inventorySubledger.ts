import type { InventoryItem, InventoryTransaction } from '../types';

export type InventoryIssueReferenceType = 'Maintenance' | 'Treatment' | 'Medicine' | 'Laboratory' | 'Adjustment';

export interface InventoryIssueRequest {
  itemId: string;
  quantity: number;
  unit: InventoryItem['unit'];
  reason: string;
  referenceType: InventoryIssueReferenceType;
  referenceId: string;
  performedBy: string;
  timestamp?: string;
}

export interface InventoryIssueResult {
  ok: boolean;
  error?: string;
  inventory?: InventoryItem[];
  transactions?: InventoryTransaction[];
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.0001;
}

export function applyInventoryIssues(inventory: InventoryItem[], requests: InventoryIssueRequest[]): InventoryIssueResult {
  const next = inventory.map((item) => ({ ...item }));
  const transactions: InventoryTransaction[] = [];
  const seen = new Set<string>();

  for (const request of requests) {
    if (!request.itemId || !request.referenceId || !request.reason.trim()) return { ok: false, error: 'INVENTORY_ISSUE_FIELDS_REQUIRED' };
    if (!Number.isFinite(request.quantity) || request.quantity <= 0) return { ok: false, error: 'INVENTORY_ISSUE_QUANTITY_INVALID' };
    const item = next.find((row) => row.id === request.itemId);
    if (!item) return { ok: false, error: 'INVENTORY_ISSUE_ITEM_NOT_FOUND' };
    if (item.unit !== request.unit) return { ok: false, error: 'INVENTORY_ISSUE_UNIT_MISMATCH' };
    if (item.status === 'Expired') return { ok: false, error: 'INVENTORY_ISSUE_EXPIRED_FORBIDDEN' };
    if ((item as InventoryItem & { qualityHold?: boolean }).qualityHold) return { ok: false, error: 'INVENTORY_ISSUE_QUALITY_HOLD_FORBIDDEN' };
    const resultingQuantity = Number((Number(item.quantity) - request.quantity).toFixed(6));
    if (resultingQuantity < -0.0001) return { ok: false, error: 'INVENTORY_ISSUE_STOCK_INSUFFICIENT' };
    item.quantity = nearlyEqual(resultingQuantity, 0) ? 0 : resultingQuantity;
    const key = `${request.referenceType}:${request.referenceId}:${item.id}:${transactions.length}`;
    if (seen.has(key)) return { ok: false, error: 'INVENTORY_ISSUE_DUPLICATE' };
    seen.add(key);
    transactions.push({
      id: `invtx_${request.referenceType.toLowerCase()}_${request.referenceId}_${item.id}_${transactions.length}`.replace(/[^a-zA-Z0-9_:-]/g, '_'),
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      type: 'Consumption (مصرف روزانه)',
      quantityChange: -request.quantity,
      resultingQuantity: item.quantity,
      unit: item.unit,
      unitPrice: item.purchasePricePerUnit,
      totalValue: Number((request.quantity * item.purchasePricePerUnit).toFixed(2)),
      referenceDoc: `${request.referenceType}:${request.referenceId}`,
      operator: request.performedBy,
      timestamp: request.timestamp || new Date().toISOString(),
      notes: request.reason,
    });
  }
  return { ok: true, inventory: next, transactions };
}
