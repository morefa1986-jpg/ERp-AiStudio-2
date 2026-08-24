import type { Express, Request, Response } from 'express';
import { MedicineLedgerStore } from './medicineLedger';
import { StoredAuditLog } from './storage';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; fullName?: string; [key: string]: unknown };
}

interface Dependencies {
  requireAuth: any;
  store: {
    getState(): { version: number; data: Record<string, unknown> } | null | undefined;
    appendAuditLog(log: StoredAuditLog): void;
  };
  auditFromOperation: (req: any, operation: any, beforeState?: string, afterState?: string) => StoredAuditLog | null;
}

const VIEW_ROLES = new Set(['Super Admin', 'Farm Owner', 'Farm Manager', 'Hall Manager', 'Veterinarian', 'Warehouse Manager', 'Viewer/Auditor']);
const LOT_WRITE_ROLES = new Set(['Super Admin', 'Farm Owner', 'Farm Manager', 'Veterinarian', 'Warehouse Manager']);
const ADMIN_WRITE_ROLES = new Set(['Super Admin', 'Farm Owner', 'Farm Manager', 'Veterinarian']);

function rows(state: Record<string, unknown>, key: string): any[] {
  return Array.isArray(state[key]) ? state[key] as any[] : [];
}

function scopedToPond(user: any, pondId: string, state: Record<string, unknown>): boolean {
  if (!user) return false;
  if (['Super Admin', 'Farm Owner', 'Farm Manager', 'Veterinarian', 'Warehouse Manager'].includes(user.role) && !(user.hallScope?.length || user.pondScope?.length)) return true;
  if (Array.isArray(user.pondScope) && user.pondScope.length) return user.pondScope.includes(pondId);
  if (Array.isArray(user.hallScope) && user.hallScope.length) {
    const pond = rows(state, 'ponds').find((row) => row?.id === pondId);
    return Boolean(pond && user.hallScope.includes(pond.hallId));
  }
  return user.role !== 'Hall Manager';
}

function errorStatus(error: unknown): number {
  const code = error instanceof Error ? error.message : String(error || '');
  if (code.includes('NOT_FOUND')) return 404;
  if (code.includes('DUPLICATE')) return 409;
  return 422;
}

export function registerMedicineLedgerRoutes(app: Express, deps: Dependencies): void {
  const ledger = new MedicineLedgerStore();

  app.get('/api/medicine/lots', deps.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || !VIEW_ROLES.has(req.user.role)) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    return res.json({ success: true, lots: ledger.listLots() });
  });

  app.post('/api/medicine/lots', deps.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || !LOT_WRITE_ROLES.has(req.user.role)) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    try {
      const lot = ledger.createLot(req.body);
      const audit = deps.auditFromOperation(req, { module: 'treatments', action: 'create', entity: 'MedicineLot', entityId: lot.id }, undefined, JSON.stringify(lot));
      if (audit) deps.store.appendAuditLog(audit);
      return res.json({ success: true, lot });
    } catch (error) {
      return res.status(errorStatus(error)).json({ success: false, error: error instanceof Error ? error.message : 'MEDICINE_LOT_CREATE_FAILED' });
    }
  });

  app.patch('/api/medicine/lots/:id', deps.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || !LOT_WRITE_ROLES.has(req.user.role)) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    try {
      if (typeof req.body?.isActive !== 'boolean') return res.status(400).json({ success: false, error: 'MEDICINE_LOT_ACTIVE_REQUIRED' });
      const before = ledger.getLot(req.params.id);
      const lot = ledger.setLotActive(req.params.id, req.body.isActive);
      const audit = deps.auditFromOperation(req, { module: 'treatments', action: 'edit', entity: 'MedicineLot', entityId: lot.id }, JSON.stringify(before), JSON.stringify(lot));
      if (audit) deps.store.appendAuditLog(audit);
      return res.json({ success: true, lot });
    } catch (error) {
      return res.status(errorStatus(error)).json({ success: false, error: error instanceof Error ? error.message : 'MEDICINE_LOT_UPDATE_FAILED' });
    }
  });

  app.get('/api/medicine/administrations', deps.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || !VIEW_ROLES.has(req.user.role)) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const state = deps.store.getState()?.data || {};
    const records = ledger.listAdministrations().filter((row) => scopedToPond(req.user, row.pondId, state));
    return res.json({ success: true, administrations: records });
  });

  app.post('/api/medicine/administrations', deps.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || !ADMIN_WRITE_ROLES.has(req.user.role)) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const state = deps.store.getState()?.data;
    if (!state) return res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' });
    const treatmentId = typeof req.body?.treatmentId === 'string' ? req.body.treatmentId.trim() : '';
    const treatment = rows(state, 'treatments').find((row) => row?.id === treatmentId);
    if (!treatment) return res.status(404).json({ success: false, error: 'TREATMENT_NOT_FOUND' });
    if (!scopedToPond(req.user, String(treatment.pondId), state)) return res.status(403).json({ success: false, error: 'POND_SCOPE_DENIED' });
    const lot = ledger.getLot(String(req.body?.lotId || ''));
    if (!lot) return res.status(404).json({ success: false, error: 'MEDICINE_LOT_NOT_FOUND' });
    if (lot.medicineName.trim().toLowerCase() !== String(treatment.drugName || '').trim().toLowerCase()) return res.status(422).json({ success: false, error: 'MEDICINE_LOT_TREATMENT_NAME_MISMATCH' });
    try {
      const record = ledger.recordAdministration({
        treatmentId: treatment.id,
        pondId: treatment.pondId,
        lotId: lot.id,
        quantityRecorded: Number(req.body?.quantityRecorded),
        unit: String(req.body?.unit || ''),
        timestamp: typeof req.body?.timestamp === 'string' && req.body.timestamp ? req.body.timestamp : new Date().toISOString(),
        recordedBy: String(req.user.fullName || req.user.id),
        notes: typeof req.body?.notes === 'string' ? req.body.notes : '',
        withdrawalEndDate: treatment.withdrawalEndDate,
      });
      const audit = deps.auditFromOperation(req, { module: 'treatments', action: 'create', entity: 'MedicineAdministration', entityId: record.id, referenceId: treatment.id }, undefined, JSON.stringify(record));
      if (audit) deps.store.appendAuditLog(audit);
      return res.json({ success: true, administration: record, lot: ledger.getLot(lot.id) });
    } catch (error) {
      return res.status(errorStatus(error)).json({ success: false, error: error instanceof Error ? error.message : 'MEDICINE_ADMINISTRATION_FAILED' });
    }
  });
}
