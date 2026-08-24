import type { Express, Request, Response } from 'express';
import { CitesPermitStatus, CitesRegistryStore } from './citesRegistry';
import { StoredAuditLog } from './storage';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; fullName?: string; [key: string]: unknown };
}
interface Dependencies {
  requireAuth: any;
  store: { getState(): { version: number; data: Record<string, unknown> } | null | undefined; appendAuditLog(log: StoredAuditLog): void };
  auditFromOperation: (req: any, operation: any, beforeState?: string, afterState?: string) => StoredAuditLog | null;
}
const VIEW_ROLES = new Set(['Super Admin','Farm Owner','Farm Manager','Processing Manager','Cold Storage Manager','Sales Manager','CRM Operator','Viewer/Auditor']);
const WRITE_ROLES = new Set(['Super Admin','Farm Owner','Farm Manager','Processing Manager','Sales Manager']);

function errorStatus(error: unknown): number {
  const code = error instanceof Error ? error.message : String(error || '');
  if (code.includes('NOT_FOUND')) return 404;
  if (code.includes('DUPLICATE')) return 409;
  return 422;
}

export function registerCitesRoutes(app: Express, deps: Dependencies): void {
  const registry = new CitesRegistryStore();

  app.get('/api/cites/permits', deps.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || !VIEW_ROLES.has(req.user.role)) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    return res.json({ success: true, permits: registry.list(), externalVerification: { configured: false } });
  });

  app.post('/api/cites/permits', deps.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || !WRITE_ROLES.has(req.user.role)) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const state = deps.store.getState()?.data;
    if (!state) return res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' });
    const batchCode = String(req.body?.batchCode || '').trim();
    const processing = Array.isArray(state.processingBatches) ? state.processingBatches.find((row: any) => row?.batchCode === batchCode) : undefined;
    if (!processing) return res.status(404).json({ success: false, error: 'CITES_PROCESSING_BATCH_NOT_FOUND' });
    const registeredNumber = String(processing.citesPermitNumber || '').trim();
    if (registeredNumber && registeredNumber !== String(req.body?.permitNumber || '').trim()) return res.status(422).json({ success: false, error: 'CITES_PROCESSING_PERMIT_NUMBER_MISMATCH' });
    try {
      const permit = registry.create({ ...req.body, speciesName: req.body?.speciesName || processing.speciesName });
      const audit = deps.auditFromOperation(req, { module: 'sales', action: 'create', entity: 'CitesPermit', entityId: permit.id, referenceId: permit.batchCode }, undefined, JSON.stringify(permit));
      if (audit) deps.store.appendAuditLog(audit);
      return res.json({ success: true, permit, externalVerification: { configured: false } });
    } catch (error) {
      return res.status(errorStatus(error)).json({ success: false, error: error instanceof Error ? error.message : 'CITES_PERMIT_CREATE_FAILED' });
    }
  });

  app.patch('/api/cites/permits/:id', deps.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || !WRITE_ROLES.has(req.user.role)) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const before = registry.getById(req.params.id);
    if (!before) return res.status(404).json({ success: false, error: 'CITES_PERMIT_NOT_FOUND' });
    try {
      const permit = registry.setStatus(req.params.id, String(req.body?.status || '') as CitesPermitStatus);
      const audit = deps.auditFromOperation(req, { module: 'sales', action: 'edit', entity: 'CitesPermit', entityId: permit.id, referenceId: permit.batchCode }, JSON.stringify(before), JSON.stringify(permit));
      if (audit) deps.store.appendAuditLog(audit);
      return res.json({ success: true, permit });
    } catch (error) {
      return res.status(errorStatus(error)).json({ success: false, error: error instanceof Error ? error.message : 'CITES_PERMIT_UPDATE_FAILED' });
    }
  });

  app.post('/api/cites/validate', deps.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || !VIEW_ROLES.has(req.user.role)) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const result = registry.validate({
      permitNumber: String(req.body?.permitNumber || ''), batchCode: String(req.body?.batchCode || ''),
      destinationCountry: typeof req.body?.destinationCountry === 'string' ? req.body.destinationCountry : undefined,
      shipmentDate: String(req.body?.shipmentDate || ''),
    });
    if (!result.valid) return res.status(422).json({ success: false, valid: false, error: result.error });
    return res.json({ success: true, valid: true, permit: result.permit, externalVerification: { configured: false } });
  });
}
