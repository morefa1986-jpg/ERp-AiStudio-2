import crypto from 'crypto';
import type { Express, Request } from 'express';
import type { InventoryItem, InventoryTransaction } from '../src/types';
import { FEED_RAW_MATERIAL_CATEGORY } from '../src/utils/feedFactoryEngine';
import { roleAllows } from '../src/utils/rbac';
import { validateActiveFeedingState, validateMutationScope, validateStateSnapshot } from '../src/utils/stateIntegrity';
import { StateConflictError, type StoredAuditLog } from './storage';

interface AuthenticatedRequest extends Request {
  user?: { id: string; fullName?: string; username?: string; role: string; [key: string]: unknown };
}
interface StateEnvelope { version: number; data: Record<string, unknown>; }
interface Dependencies {
  requireAuth: any;
  store: {
    getState(): StateEnvelope | null | undefined;
    saveStateAndAudit(data: Record<string, unknown>, expectedVersion: number | null, audit: StoredAuditLog): StateEnvelope;
  };
  filterStateForUser: (data: Record<string, unknown>, user: any) => Record<string, unknown>;
  auditFromOperation: (req: any, operation: any, beforeState?: string, afterState?: string) => StoredAuditLog | null;
}

type FeedRawMaterialItem = Omit<InventoryItem, 'category'> & { category: typeof FEED_RAW_MATERIAL_CATEGORY };

function clean(value: unknown, max: number): string { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function actor(req: AuthenticatedRequest): string { return clean(req.user?.fullName || req.user?.username || req.user?.id || 'operator', 200); }
function inventoryOf(data: Record<string, unknown>): InventoryItem[] { return Array.isArray(data.inventory) ? data.inventory as InventoryItem[] : []; }
function txsOf(data: Record<string, unknown>): InventoryTransaction[] { return Array.isArray(data.inventoryTxs) ? data.inventoryTxs as InventoryTransaction[] : []; }
function safeCode(value: unknown, max = 100): string { return clean(value, max).toUpperCase().replace(/[^A-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, ''); }
function validDateOnly(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00`).getTime()); }
function expired(value: string): boolean { return new Date(`${value}T23:59:59.999`).getTime() < Date.now(); }
function nonNegative(value: unknown): number | null { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null; }

export function registerFeedFactoryRawMaterialRoutes(app: Express, deps: Dependencies): void {
  app.post('/api/feed-factory/raw-materials', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!req.user || !roleAllows(req.user.role, 'feed_factory', 'create')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });

    const sku = safeCode(req.body?.sku);
    const batchNumber = safeCode(req.body?.batchNumber);
    const name = clean(req.body?.name, 240);
    const unit = req.body?.unit === 'gram' ? 'gram' : req.body?.unit === 'kg' ? 'kg' : '';
    const quantity = nonNegative(req.body?.quantity);
    const unitPrice = nonNegative(req.body?.purchasePricePerUnit);
    const currency = safeCode(req.body?.currency, 12);
    const expiryDate = clean(req.body?.expiryDate, 10);
    const supplierName = clean(req.body?.supplierName, 240);
    const warehouseLocation = clean(req.body?.warehouseLocation, 240);
    const minimumStockThreshold = nonNegative(req.body?.minimumStockThreshold);
    const reorderLevel = nonNegative(req.body?.reorderLevel);

    if (!sku || !batchNumber || !name || !unit || quantity === null || quantity <= 0 || unitPrice === null || !currency || !supplierName || !warehouseLocation || minimumStockThreshold === null || reorderLevel === null || !validDateOnly(expiryDate) || expired(expiryDate)) {
      return res.status(400).json({ success: false, error: 'FEED_RAW_MATERIAL_FIELDS_INVALID' });
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = deps.store.getState();
      if (!current) return res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' });
      const inventory = inventoryOf(current.data);
      if (inventory.some((item) => item.sku.toLowerCase() === sku.toLowerCase())) return res.status(409).json({ success: false, error: 'INVENTORY_SKU_EXISTS' });
      const itemId = `inv_raw_${crypto.randomUUID()}`;
      const rawItem: FeedRawMaterialItem = {
        id: itemId,
        sku,
        name,
        category: FEED_RAW_MATERIAL_CATEGORY,
        batchNumber,
        quantity,
        unit,
        purchasePricePerUnit: unitPrice,
        currency,
        expiryDate,
        supplierName,
        warehouseLocation,
        minimumStockThreshold,
        reorderLevel,
        status: quantity <= minimumStockThreshold ? 'Critical Low' : quantity <= reorderLevel ? 'Low Stock' : 'Adequate',
      };
      const now = new Date().toISOString();
      const tx: InventoryTransaction = {
        id: `invtx_${crypto.randomUUID()}`,
        itemId,
        itemName: name,
        sku,
        type: 'Purchase (خرید)',
        quantityChange: quantity,
        resultingQuantity: quantity,
        unit,
        unitPrice,
        totalValue: Number((quantity * unitPrice).toFixed(2)),
        referenceDoc: `FEED-RAW-${batchNumber}`,
        operator: actor(req),
        timestamp: now,
        notes: 'Feed factory registered raw-material opening lot',
      };
      const next = {
        ...current.data,
        inventory: [...inventory, rawItem] as unknown as InventoryItem[],
        inventoryTxs: [...txsOf(current.data), tx],
      };
      const snapshot = validateStateSnapshot(next);
      if (!snapshot.ok) return res.status(422).json({ success: false, error: snapshot.error });
      const feeding = validateActiveFeedingState(next);
      if (!feeding.ok) return res.status(422).json({ success: false, error: feeding.error });
      const scope = validateMutationScope(current.data, next, { module: 'feed_factory', action: 'create' });
      if (!scope.ok) return res.status(422).json({ success: false, error: scope.error });
      if (tx.itemId !== rawItem.id || tx.resultingQuantity !== rawItem.quantity || tx.quantityChange !== rawItem.quantity || tx.unit !== rawItem.unit) {
        return res.status(422).json({ success: false, error: 'FEED_RAW_MATERIAL_LEDGER_INVALID' });
      }
      const audit = deps.auditFromOperation(req, {
        module: 'feed_factory', action: 'create', entity: 'FeedRawMaterialLot', entityId: rawItem.id,
        referenceId: rawItem.sku, transactionId: tx.id,
      }, undefined, JSON.stringify(rawItem));
      if (!audit) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });
      try {
        const saved = deps.store.saveStateAndAudit(next, current.version, audit);
        return res.status(201).json({ success: true, item: rawItem, transaction: tx, state: { ...saved, data: deps.filterStateForUser(saved.data, req.user) } });
      } catch (error) {
        if (error instanceof StateConflictError) continue;
        return res.status(500).json({ success: false, error: 'FEED_RAW_MATERIAL_SAVE_FAILED' });
      }
    }
    return res.status(409).json({ success: false, error: 'STATE_VERSION_CONFLICT' });
  });
}
