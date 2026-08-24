import type { Express, Request, Response } from 'express';
import { ColdStorageEvent, ColdStorageLedgerStore } from './coldStorageLedger';
import { StateConflictError, StoredAuditLog } from './storage';
import { roleAllows } from '../src/utils/rbac';
import { validateStateSnapshot } from '../src/utils/stateIntegrity';

interface AuthenticatedRequest extends Request {
  user?: { id: string; fullName?: string; username?: string; role: string; [key: string]: unknown };
}

interface StateEnvelope { version: number; data: Record<string, unknown>; }
interface ColdStorageStore {
  getState(): StateEnvelope | null | undefined;
  saveStateAndAudit(data: Record<string, unknown>, expectedVersion: number | null, audit: StoredAuditLog): StateEnvelope;
}

interface Dependencies {
  requireAuth: any;
  store: ColdStorageStore;
  filterStateForUser: (data: Record<string, unknown>, user: any) => Record<string, unknown>;
  auditFromOperation: (req: any, operation: any, beforeState?: string, afterState?: string) => StoredAuditLog | null;
}

function clean(value: unknown, max: number): string { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function finite(value: unknown): number | null { const n = Number(value); return Number.isFinite(n) ? n : null; }
function actor(req: AuthenticatedRequest): string { return clean(req.user?.fullName || req.user?.username || req.user?.id || 'operator', 200); }

export function registerColdStorageRoutes(app: Express, deps: Dependencies): void {
  const ledger = new ColdStorageLedgerStore();

  const allowed = (req: AuthenticatedRequest, action: 'view' | 'edit' | 'approve'): boolean => Boolean(req.user && roleAllows(req.user.role, 'cold_storage', action));
  const current = (res: Response): StateEnvelope | null => {
    const state = deps.store.getState();
    if (!state) { res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' }); return null; }
    return state;
  };
  const rows = (state: StateEnvelope): any[] => Array.isArray(state.data.coldStorage) ? state.data.coldStorage as any[] : [];

  const commit = (
    req: AuthenticatedRequest,
    res: Response,
    previous: StateEnvelope,
    nextPallet: any,
    event: Omit<ColdStorageEvent, 'id' | 'timestamp' | 'actor'>,
    action: 'edit' | 'approve',
  ) => {
    const nextRows = rows(previous).map((row) => row.id === nextPallet.id ? nextPallet : row);
    const next = { ...previous.data, coldStorage: nextRows };
    const snapshot = validateStateSnapshot(next);
    if (!snapshot.ok) return res.status(422).json({ success: false, error: snapshot.error });
    const audit = deps.auditFromOperation(req, { module: 'cold_storage', action, entity: 'ColdStoragePallet', entityId: nextPallet.id }, JSON.stringify(rows(previous).find((row) => row.id === nextPallet.id)), JSON.stringify(nextPallet));
    if (!audit) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });
    try {
      const saved = deps.store.saveStateAndAudit(next, previous.version, audit);
      try { ledger.append({ ...event, actor: actor(req) }); } catch { /* canonical state + audit already committed */ }
      return res.json({ success: true, pallet: nextPallet, state: { ...saved, data: deps.filterStateForUser(saved.data, req.user) } });
    } catch (error) {
      if (error instanceof StateConflictError) return res.status(409).json({ success: false, error: 'STATE_VERSION_CONFLICT', state: { ...error.current, data: deps.filterStateForUser(error.current.data, req.user) } });
      return res.status(500).json({ success: false, error: 'COLD_STORAGE_SAVE_FAILED' });
    }
  };

  const pallet = (previous: StateEnvelope, id: string, res: Response): any | null => {
    const found = rows(previous).find((row) => row.id === id);
    if (!found) { res.status(404).json({ success: false, error: 'COLD_STORAGE_PALLET_NOT_FOUND' }); return null; }
    return found;
  };

  app.get('/api/cold-storage/events', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'view')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    return res.json({ success: true, events: ledger.list(Number(req.query.limit) || 500, clean(req.query.palletId, 160) || undefined) });
  });

  app.post('/api/cold-storage/:id/move', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'edit')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const previous = current(res); if (!previous) return;
    const found = pallet(previous, req.params.id, res); if (!found) return;
    const slotCode = clean(req.body?.slotCode, 80);
    if (!slotCode) return res.status(400).json({ success: false, error: 'COLD_STORAGE_SLOT_REQUIRED' });
    const duplicate = rows(previous).some((row) => row.id !== found.id && row.slotCode === slotCode && Number(row.weightKg) > 0);
    if (duplicate) return res.status(409).json({ success: false, error: 'COLD_STORAGE_SLOT_OCCUPIED' });
    const nextPallet = { ...found, slotCode };
    return commit(req, res, previous, nextPallet, { palletId: found.id, batchCode: String(found.batchCode), eventType: 'MOVE', notes: clean(req.body?.notes, 1000), previousSlotCode: String(found.slotCode || ''), nextSlotCode: slotCode }, 'edit');
  });

  app.post('/api/cold-storage/:id/temperature-check', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'edit')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const previous = current(res); if (!previous) return;
    const found = pallet(previous, req.params.id, res); if (!found) return;
    const temperatureC = finite(req.body?.temperatureC); const minAllowedC = finite(req.body?.minAllowedC); const maxAllowedC = finite(req.body?.maxAllowedC);
    if (temperatureC === null || minAllowedC === null || maxAllowedC === null || minAllowedC > maxAllowedC) return res.status(400).json({ success: false, error: 'COLD_STORAGE_TEMPERATURE_RANGE_INVALID' });
    if (temperatureC < -100 || temperatureC > 100 || minAllowedC < -100 || maxAllowedC > 100) return res.status(400).json({ success: false, error: 'COLD_STORAGE_TEMPERATURE_PHYSICAL_INVALID' });
    const withinRange = temperatureC >= minAllowedC && temperatureC <= maxAllowedC;
    const reason = withinRange ? undefined : `Temperature ${temperatureC}°C outside recorded range ${minAllowedC}..${maxAllowedC}°C`;
    const nextPallet = { ...found, temperatureC, qualityHold: withinRange ? Boolean(found.qualityHold) : true, qualityHoldReason: withinRange ? found.qualityHoldReason : reason, qualityHoldSince: withinRange ? found.qualityHoldSince : new Date().toISOString() };
    return commit(req, res, previous, nextPallet, { palletId: found.id, batchCode: String(found.batchCode), eventType: 'TEMPERATURE_CHECK', notes: clean(req.body?.notes, 1000), temperatureC, minAllowedC, maxAllowedC, withinRange, reason }, 'edit');
  });

  app.post('/api/cold-storage/:id/hold', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'edit')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const previous = current(res); if (!previous) return;
    const found = pallet(previous, req.params.id, res); if (!found) return;
    const reason = clean(req.body?.reason, 500);
    if (!reason) return res.status(400).json({ success: false, error: 'COLD_STORAGE_HOLD_REASON_REQUIRED' });
    const nextPallet = { ...found, qualityHold: true, qualityHoldReason: reason, qualityHoldSince: new Date().toISOString() };
    return commit(req, res, previous, nextPallet, { palletId: found.id, batchCode: String(found.batchCode), eventType: 'QUALITY_HOLD', notes: clean(req.body?.notes, 1000), reason }, 'edit');
  });

  app.post('/api/cold-storage/:id/release', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'approve')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const previous = current(res); if (!previous) return;
    const found = pallet(previous, req.params.id, res); if (!found) return;
    if (!found.qualityHold) return res.status(409).json({ success: false, error: 'COLD_STORAGE_NOT_ON_HOLD' });
    const reason = clean(req.body?.reason, 500);
    if (!reason) return res.status(400).json({ success: false, error: 'COLD_STORAGE_RELEASE_REASON_REQUIRED' });
    const nextPallet = { ...found, qualityHold: false, qualityHoldReason: undefined, qualityHoldSince: undefined };
    return commit(req, res, previous, nextPallet, { palletId: found.id, batchCode: String(found.batchCode), eventType: 'RELEASE', notes: clean(req.body?.notes, 1000), reason }, 'approve');
  });

  app.post('/api/cold-storage/:id/cycle-count', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'edit')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const previous = current(res); if (!previous) return;
    const found = pallet(previous, req.params.id, res); if (!found) return;
    const unitsCount = finite(req.body?.unitsCount); const weightKg = finite(req.body?.weightKg); const reason = clean(req.body?.reason, 500);
    if (unitsCount === null || weightKg === null || !Number.isInteger(unitsCount) || unitsCount < 0 || weightKg < 0 || !reason) return res.status(400).json({ success: false, error: 'COLD_STORAGE_CYCLE_COUNT_INVALID' });
    const nextPallet = { ...found, unitsCount, weightKg: Number(weightKg.toFixed(4)) };
    return commit(req, res, previous, nextPallet, { palletId: found.id, batchCode: String(found.batchCode), eventType: 'CYCLE_COUNT', notes: clean(req.body?.notes, 1000), previousUnitsCount: Number(found.unitsCount || 0), nextUnitsCount: unitsCount, previousWeightKg: Number(found.weightKg || 0), nextWeightKg: Number(weightKg.toFixed(4)), reason }, 'edit');
  });
}
