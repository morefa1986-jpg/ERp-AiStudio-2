import { getStoredSessionToken } from '../context/AuthContext';
import type { FeedFormulaIngredient } from '../utils/feedFactoryEngine';

export interface FeedFormulaRecord {
  id: string;
  code: string;
  name: string;
  outputName: string;
  outputSkuBase: string;
  outputUnit: 'kg' | 'gram';
  basisOutputKg: number;
  ingredients: FeedFormulaIngredient[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export type FeedProductionBatchStatus = 'PENDING_QC' | 'RELEASED' | 'REJECTED';
export interface FeedProductionBatchRecord {
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
  status: FeedProductionBatchStatus;
  createdAt: string;
  createdBy: string;
  qcAt?: string;
  qcBy?: string;
  qcNotes?: string;
  outputInventoryItemId?: string;
  inputTransactionIds: string[];
}

function headers(): HeadersInit {
  const token = getStoredSessionToken();
  return { Authorization: `Bearer ${token || ''}`, 'Content-Type': 'application/json' };
}

async function call(path: string, options: { method?: string; body?: unknown } = {}): Promise<any> {
  const response = await fetch(path, {
    method: options.method || (options.body === undefined ? 'GET' : 'POST'),
    headers: headers(),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.error || 'FEED_FACTORY_REQUEST_FAILED');
  return payload;
}

export async function listFeedFormulas(): Promise<FeedFormulaRecord[]> {
  const payload = await call('/api/feed-factory/formulas');
  return Array.isArray(payload.formulas) ? payload.formulas : [];
}

export async function createFeedFormula(input: Omit<FeedFormulaRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>): Promise<FeedFormulaRecord> {
  const payload = await call('/api/feed-factory/formulas', { body: input });
  return payload.formula as FeedFormulaRecord;
}

export async function updateFeedFormula(id: string, input: Partial<Omit<FeedFormulaRecord, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>>): Promise<FeedFormulaRecord> {
  const payload = await call(`/api/feed-factory/formulas/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
  return payload.formula as FeedFormulaRecord;
}

export async function listFeedProductionBatches(): Promise<FeedProductionBatchRecord[]> {
  const payload = await call('/api/feed-factory/batches');
  return Array.isArray(payload.batches) ? payload.batches : [];
}

export async function startFeedProductionBatch(input: {
  formulaId: string;
  batchCode: string;
  outputKg: number;
  outputSku?: string;
  warehouseLocation: string;
  expiryDate: string;
  minimumStockThreshold?: number;
  reorderLevel?: number;
}): Promise<FeedProductionBatchRecord> {
  const payload = await call('/api/feed-factory/batches', { body: input });
  return payload.batch as FeedProductionBatchRecord;
}

export async function decideFeedProductionQc(id: string, decision: 'RELEASE' | 'REJECT', notes?: string): Promise<FeedProductionBatchRecord> {
  const payload = await call(`/api/feed-factory/batches/${encodeURIComponent(id)}/qc`, { body: { decision, notes } });
  return payload.batch as FeedProductionBatchRecord;
}

export function reloadFeedFactoryView(): void {
  try { window.sessionStorage.setItem('fathi_restore_view', 'feedFactory'); } catch { /* non-browser/test runtime */ }
  window.location.reload();
}
