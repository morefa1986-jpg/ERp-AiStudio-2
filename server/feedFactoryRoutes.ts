import crypto from 'crypto';
import type { Express, Request } from 'express';
import type { InventoryItem, InventoryTransaction } from '../src/types';
import { planFeedProduction, validateFeedFormula, type FeedFormulaDefinition } from '../src/utils/feedFactoryEngine';
import { roleAllows } from '../src/utils/rbac';
import { validateActiveFeedingState, validateMutationScope, validateStateMutation, validateStateSnapshot } from '../src/utils/stateIntegrity';
import { FeedFactoryFormulaStore, type StoredFeedFormula } from './feedFactoryFormulaStore';
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
    appendAuditLog(log: StoredAuditLog): void;
    listAuditLogs(limit?: number): StoredAuditLog[];
  };
  filterStateForUser: (data: Record<string, unknown>, user: any) => Record<string, unknown>;
  auditFromOperation: (req: any, operation: any, beforeState?: string, afterState?: string) => StoredAuditLog | null;
}

type BatchStatus = 'PENDING_QC' | 'RELEASED' | 'REJECTED';
export interface FeedProductionBatchSummary {
  id: string;
  batchCode: string;
  formulaId: string;
  formulaCode: string;
  formulaName: string;
  outputName: string;
  outputSku: string;
  outputUnit: 'kg' | 'gram';
  outputQuantity: number;
  outputKg: number;
  totalInputKg: number;
  processLossKg: number;
  totalInputValue: number;
  outputUnitCost: number;
  currency: string;
  warehouseLocation: string;
  expiryDate: string;
  minimumStockThreshold: number;
  reorderLevel: number;
  status: BatchStatus;
  createdAt: string;
  createdBy: string;
  qcAt?: string;
  qcBy?: string;
  qcNotes?: string;
  outputInventoryItemId?: string;
  inputTransactionIds: string[];
}

function clean(value: unknown, max: number): string { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function actor(req: AuthenticatedRequest): string { return clean(req.user?.fullName || req.user?.username || req.user?.id || 'operator', 200); }
function inventoryOf(data: Record<string, unknown>): InventoryItem[] { return Array.isArray(data.inventory) ? data.inventory as InventoryItem[] : []; }
function txsOf(data: Record<string, unknown>): InventoryTransaction[] { return Array.isArray(data.inventoryTxs) ? data.inventoryTxs as InventoryTransaction[] : []; }
function allowed(req: AuthenticatedRequest, action: 'view' | 'create' | 'edit' | 'approve'): boolean { return Boolean(req.user && roleAllows(req.user.role, 'feed_factory', action)); }
function validDateOnly(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00`).getTime()); }
function expiredDate(value: string): boolean { return new Date(`${value}T23:59:59.999`).getTime() < Date.now(); }
function numberOrZero(value: unknown): number { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : 0; }
function safeSku(raw: string): string { return raw.toUpperCase().replace(/[^A-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100); }

function inventoryStatus(item: InventoryItem, quantity: number): InventoryItem['status'] {
  if (item.expiryDate && expiredDate(item.expiryDate)) return 'Expired';
  if (quantity <= item.minimumStockThreshold) return 'Critical Low';
  if (quantity <= item.reorderLevel) return 'Low Stock';
  return 'Adequate';
}

function parseBatchAudit(log: StoredAuditLog): FeedProductionBatchSummary | null {
  if (log.entity !== 'FeedProductionBatch' || !log.afterState) return null;
  try {
    const parsed = JSON.parse(log.afterState) as FeedProductionBatchSummary;
    return parsed?.id && parsed?.batchCode ? parsed : null;
  } catch { return null; }
}

function listCurrentBatches(logs: StoredAuditLog[]): FeedProductionBatchSummary[] {
  const current = new Map<string, FeedProductionBatchSummary>();
  for (const log of logs) {
    const batch = parseBatchAudit(log);
    if (batch && !current.has(batch.id)) current.set(batch.id, batch);
  }
  return Array.from(current.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function previewFormula(existing: StoredFeedFormula | undefined, raw: any): FeedFormulaDefinition {
  return {
    id: existing?.id || 'preview',
    code: raw?.code === undefined ? existing?.code || '' : clean(raw.code, 100),
    name: raw?.name === undefined ? existing?.name || '' : clean(raw.name, 200),
    outputName: raw?.outputName === undefined ? existing?.outputName || '' : clean(raw.outputName, 200),
    outputSkuBase: raw?.outputSkuBase === undefined ? existing?.outputSkuBase || '' : clean(raw.outputSkuBase, 100),
    outputUnit: raw?.outputUnit === undefined ? existing?.outputUnit || 'kg' : raw.outputUnit === 'gram' ? 'gram' : 'kg',
    basisOutputKg: raw?.basisOutputKg === undefined ? Number(existing?.basisOutputKg || 0) : Number(raw.basisOutputKg),
    ingredients: raw?.ingredients === undefined ? existing?.ingredients || [] : Array.isArray(raw.ingredients) ? raw.ingredients.map((row: any) => ({ itemId: clean(row?.itemId, 160), quantityKg: Number(row?.quantityKg) })) : [],
    isActive: raw?.isActive === undefined ? existing?.isActive !== false : Boolean(raw.isActive),
  };
}

function requestError(error: unknown): { status: number; code: string } {
  const code = error instanceof Error ? error.message : 'FEED_FACTORY_REQUEST_FAILED';
  if (code.includes('NOT_FOUND')) return { status: 404, code };
  if (code.includes('UNIQUE') || code.includes('constraint') || code.includes('EXISTS') || code.includes('FINALIZED')) return { status: 409, code };
  return { status: 400, code };
}

export function registerFeedFactoryRoutes(app: Express, deps: Dependencies): void {
  const formulas = new FeedFactoryFormulaStore();

  const auditFor = (req: AuthenticatedRequest, action: 'create' | 'edit' | 'approve', batch: FeedProductionBatchSummary, before?: FeedProductionBatchSummary): StoredAuditLog => {
    const audit = deps.auditFromOperation(req, {
      module: 'feed_factory', action, entity: 'FeedProductionBatch', entityId: batch.id,
      referenceId: batch.batchCode, transactionId: `feedbatch_${batch.id}`,
    }, before ? JSON.stringify(before) : undefined, JSON.stringify(batch));
    if (!audit) throw new Error('AUTH_REQUIRED');
    return audit;
  };

  const currentBatches = () => listCurrentBatches(deps.store.listAuditLogs(5000));

  app.get('/api/feed-factory/formulas', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'view')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    return res.json({ success: true, formulas: formulas.list() });
  });

  app.get('/api/feed-factory/formulas/:id/events', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'view')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    return res.json({ success: true, events: formulas.events(req.params.id, Number(req.query.limit) || 200) });
  });

  app.post('/api/feed-factory/formulas', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'create')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const state = deps.store.getState();
    if (!state) return res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' });
    const candidate = previewFormula(undefined, req.body);
    const validation = validateFeedFormula(candidate, inventoryOf(state.data));
    if (!validation.ok) return res.status(400).json({ success: false, error: validation.error });
    try {
      const formula = formulas.create(candidate, actor(req));
      const log = deps.auditFromOperation(req, { module: 'feed_factory', action: 'create', entity: 'FeedFormula', entityId: formula.id, referenceId: formula.code }, undefined, JSON.stringify(formula));
      if (log) deps.store.appendAuditLog(log);
      return res.status(201).json({ success: true, formula });
    } catch (error) { const mapped = requestError(error); return res.status(mapped.status).json({ success: false, error: mapped.code }); }
  });

  app.patch('/api/feed-factory/formulas/:id', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'edit')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const existing = formulas.get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'FEED_FORMULA_NOT_FOUND' });
    const state = deps.store.getState();
    if (!state) return res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' });
    const candidate = previewFormula(existing, req.body);
    const validation = validateFeedFormula(candidate, inventoryOf(state.data));
    if (!validation.ok) return res.status(400).json({ success: false, error: validation.error });
    try {
      const formula = formulas.update(existing.id, candidate, actor(req));
      const log = deps.auditFromOperation(req, { module: 'feed_factory', action: 'edit', entity: 'FeedFormula', entityId: formula.id, referenceId: formula.code }, JSON.stringify(existing), JSON.stringify(formula));
      if (log) deps.store.appendAuditLog(log);
      return res.json({ success: true, formula });
    } catch (error) { const mapped = requestError(error); return res.status(mapped.status).json({ success: false, error: mapped.code }); }
  });

  app.get('/api/feed-factory/batches', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'view')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    return res.json({ success: true, batches: currentBatches().slice(0, Math.max(1, Math.min(1000, Number(req.query.limit) || 500))) });
  });

  app.post('/api/feed-factory/batches', deps.requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'create')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const formulaId = clean(req.body?.formulaId, 160);
    const formula = formulas.get(formulaId);
    if (!formula) return res.status(404).json({ success: false, error: 'FEED_FORMULA_NOT_FOUND' });
    const batchCode = clean(req.body?.batchCode, 100);
    const outputKg = Number(req.body?.outputKg);
    const warehouseLocation = clean(req.body?.warehouseLocation, 200);
    const expiryDate = clean(req.body?.expiryDate, 10);
    const requestedSku = safeSku(clean(req.body?.outputSku, 100) || `${formula.outputSkuBase}-${batchCode}`);
    if (!batchCode || !requestedSku || !warehouseLocation || !validDateOnly(expiryDate) || expiredDate(expiryDate) || !Number.isFinite(outputKg) || outputKg <= 0) {
      return res.status(400).json({ success: false, error: 'FEED_BATCH_FIELDS_INVALID' });
    }
    if (currentBatches().some((batch) => batch.batchCode.toLowerCase() === batchCode.toLowerCase())) {
      return res.status(409).json({ success: false, error: 'FEED_BATCH_CODE_EXISTS' });
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = deps.store.getState();
      if (!current) return res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' });
      const inventory = inventoryOf(current.data);
      if (inventory.some((item) => item.sku.toLowerCase() === requestedSku.toLowerCase())) return res.status(409).json({ success: false, error: 'FEED_OUTPUT_SKU_EXISTS' });
      const plan = planFeedProduction(formula, outputKg, inventory);
      if (!plan.ok || !plan.inputChanges || !plan.currency || plan.outputQuantity === undefined || plan.outputUnitCost === undefined || plan.totalInputValue === undefined || plan.totalInputKg === undefined || plan.processLossKg === undefined) {
        return res.status(400).json({ success: false, error: plan.error || 'FEED_PRODUCTION_PLAN_INVALID' });
      }
      const now = new Date().toISOString();
      const batchId = `feedbatch_${crypto.randomUUID()}`;
      const txs: InventoryTransaction[] = [];
      const nextInventory = inventory.map((item) => {
        const change = plan.inputChanges!.find((row) => row.itemId === item.id);
        if (!change) return item;
        txs.push({
          id: `invtx_${crypto.randomUUID()}`, itemId: item.id, itemName: item.name, sku: item.sku,
          type: 'Consumption (مصرف روزانه)', quantityChange: change.quantityChange, resultingQuantity: change.resultingQuantity,
          unit: item.unit, unitPrice: item.purchasePricePerUnit, totalValue: Number((Math.abs(change.quantityChange) * item.purchasePricePerUnit).toFixed(2)),
          referenceDoc: batchId, operator: actor(req), timestamp: now, notes: `Feed factory batch ${batchCode} / formula ${formula.code}`,
        });
        return { ...item, quantity: change.resultingQuantity, status: inventoryStatus(item, change.resultingQuantity) };
      });
      const batch: FeedProductionBatchSummary = {
        id: batchId, batchCode, formulaId: formula.id, formulaCode: formula.code, formulaName: formula.name,
        outputName: formula.outputName, outputSku: requestedSku, outputUnit: formula.outputUnit,
        outputQuantity: plan.outputQuantity, outputKg: plan.outputKg!, totalInputKg: plan.totalInputKg,
        processLossKg: plan.processLossKg, totalInputValue: plan.totalInputValue, outputUnitCost: plan.outputUnitCost,
        currency: plan.currency, warehouseLocation, expiryDate,
        minimumStockThreshold: numberOrZero(req.body?.minimumStockThreshold), reorderLevel: numberOrZero(req.body?.reorderLevel),
        status: 'PENDING_QC', createdAt: now, createdBy: actor(req), inputTransactionIds: txs.map((tx) => tx.id),
      };
      const next = { ...current.data, inventory: nextInventory, inventoryTxs: [...txsOf(current.data), ...txs] };
      const operation = { module: 'feed_factory', action: 'create' };
      const mutation = validateStateMutation(current.data, next, operation);
      if (!mutation.ok) return res.status(422).json({ success: false, error: mutation.error });
      const scope = validateMutationScope(current.data, next, operation);
      if (!scope.ok) return res.status(422).json({ success: false, error: scope.error });
      try {
        const saved = deps.store.saveStateAndAudit(next, current.version, auditFor(req, 'create', batch));
        return res.status(201).json({ success: true, batch, state: { ...saved, data: deps.filterStateForUser(saved.data, req.user) } });
      } catch (error) {
        if (error instanceof StateConflictError) continue;
        return res.status(500).json({ success: false, error: 'FEED_BATCH_SAVE_FAILED' });
      }
    }
    return res.status(409).json({ success: false, error: 'STATE_VERSION_CONFLICT' });
  });

  app.post('/api/feed-factory/batches/:id/qc', deps.requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'approve')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const decision = clean(req.body?.decision, 20).toUpperCase();
    if (!['RELEASE', 'REJECT'].includes(decision)) return res.status(400).json({ success: false, error: 'FEED_QC_DECISION_INVALID' });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const before = currentBatches().find((batch) => batch.id === req.params.id);
      if (!before) return res.status(404).json({ success: false, error: 'FEED_BATCH_NOT_FOUND' });
      if (before.status !== 'PENDING_QC') return res.status(409).json({ success: false, error: 'FEED_BATCH_FINALIZED' });
      const current = deps.store.getState();
      if (!current) return res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' });
      const now = new Date().toISOString();
      const batch: FeedProductionBatchSummary = { ...before, status: decision === 'RELEASE' ? 'RELEASED' : 'REJECTED', qcAt: now, qcBy: actor(req), qcNotes: clean(req.body?.notes, 1500) || undefined };

      if (decision === 'REJECT') {
        try {
          const audit = auditFor(req, 'edit', batch, before);
          const saved = deps.store.saveStateAndAudit(current.data, current.version, audit);
          return res.json({ success: true, batch, state: { ...saved, data: deps.filterStateForUser(saved.data, req.user) } });
        } catch (error) {
          if (error instanceof StateConflictError) continue;
          return res.status(500).json({ success: false, error: 'FEED_QC_SAVE_FAILED' });
        }
      }

      const inventory = inventoryOf(current.data);
      if (inventory.some((item) => item.sku.toLowerCase() === batch.outputSku.toLowerCase())) return res.status(409).json({ success: false, error: 'FEED_OUTPUT_SKU_EXISTS' });
      const itemId = `inv_feed_${crypto.randomUUID()}`;
      const outputItem: InventoryItem = {
        id: itemId, sku: batch.outputSku, name: batch.outputName, category: 'Feed (خوراک)', batchNumber: batch.batchCode,
        quantity: batch.outputQuantity, unit: batch.outputUnit, purchasePricePerUnit: batch.outputUnitCost, currency: batch.currency,
        expiryDate: batch.expiryDate, supplierName: 'Internal Feed Factory', warehouseLocation: batch.warehouseLocation,
        minimumStockThreshold: batch.minimumStockThreshold, reorderLevel: batch.reorderLevel,
        status: batch.outputQuantity <= batch.minimumStockThreshold ? 'Critical Low' : batch.outputQuantity <= batch.reorderLevel ? 'Low Stock' : 'Adequate',
      };
      const productionTx: InventoryTransaction = {
        id: `invtx_${crypto.randomUUID()}`, itemId, itemName: outputItem.name, sku: outputItem.sku,
        type: 'Production (تولید)', quantityChange: outputItem.quantity, resultingQuantity: outputItem.quantity,
        unit: outputItem.unit, unitPrice: outputItem.purchasePricePerUnit, totalValue: Number((outputItem.quantity * outputItem.purchasePricePerUnit).toFixed(2)),
        referenceDoc: batch.id, operator: actor(req), timestamp: now, notes: `QC released feed factory batch ${batch.batchCode}`,
      };
      batch.outputInventoryItemId = itemId;
      const next = { ...current.data, inventory: [...inventory, outputItem], inventoryTxs: [...txsOf(current.data), productionTx] };
      const snapshot = validateStateSnapshot(next);
      if (!snapshot.ok) return res.status(422).json({ success: false, error: snapshot.error });
      const feeding = validateActiveFeedingState(next);
      if (!feeding.ok) return res.status(422).json({ success: false, error: feeding.error });
      const scope = validateMutationScope(current.data, next, { module: 'feed_factory', action: 'approve' });
      if (!scope.ok) return res.status(422).json({ success: false, error: scope.error });
      if (productionTx.quantityChange <= 0 || productionTx.resultingQuantity !== outputItem.quantity || productionTx.itemId !== outputItem.id) {
        return res.status(422).json({ success: false, error: 'FEED_PRODUCTION_OUTPUT_LEDGER_INVALID' });
      }
      try {
        const saved = deps.store.saveStateAndAudit(next, current.version, auditFor(req, 'approve', batch, before));
        return res.json({ success: true, batch, outputItem, state: { ...saved, data: deps.filterStateForUser(saved.data, req.user) } });
      } catch (error) {
        if (error instanceof StateConflictError) continue;
        return res.status(500).json({ success: false, error: 'FEED_QC_SAVE_FAILED' });
      }
    }
    return res.status(409).json({ success: false, error: 'STATE_VERSION_CONFLICT' });
  });
}
