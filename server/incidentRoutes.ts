import type { Express, Request, Response } from 'express';
import { deriveOperationalIncidents, IncidentStore } from './incidentEngine';
import { StoredAuditLog } from './storage';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; fullName?: string; hallScope?: string[]; pondScope?: string[]; [key: string]: unknown };
}
interface Dependencies {
  requireAuth: any;
  store: { getState(): { version: number; data: Record<string, unknown> } | null | undefined; appendAuditLog(log: StoredAuditLog): void };
  auditFromOperation: (req: any, operation: any, beforeState?: string, afterState?: string) => StoredAuditLog | null;
}
const ESCALATE_ROLES = new Set(['Super Admin','Farm Owner','Farm Manager','Hall Manager','Veterinarian']);
const RESOLVE_ROLES = new Set(['Super Admin','Farm Owner','Farm Manager','Hall Manager','Veterinarian']);

function scoped(user: any, incident: { pondId?: string; hallId?: string }): boolean {
  if (!user) return false;
  if (Array.isArray(user.pondScope) && user.pondScope.length && incident.pondId) return user.pondScope.includes(incident.pondId);
  if (Array.isArray(user.hallScope) && user.hallScope.length && incident.hallId) return user.hallScope.includes(incident.hallId);
  if ((user.pondScope?.length || user.hallScope?.length) && !incident.pondId && !incident.hallId) return false;
  return true;
}

export function registerIncidentRoutes(app: Express, deps: Dependencies): void {
  const incidents = new IncidentStore();
  const syncAndList = (req: AuthenticatedRequest) => {
    const state = deps.store.getState()?.data || {};
    return incidents.syncCandidates(deriveOperationalIncidents(state)).filter((row) => scoped(req.user, row));
  };

  app.get('/api/incidents/capabilities', deps.requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    return res.json({ success: true, internalWorkflow: true, externalNotifications: { configured: false, sms: false, email: false }, note: 'External notification provider is not configured or implemented in this build.' });
  });
  app.get('/api/incidents', deps.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });
    return res.json({ success: true, incidents: syncAndList(req) });
  });
  app.post('/api/incidents/sync', deps.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });
    return res.json({ success: true, incidents: syncAndList(req) });
  });

  app.patch('/api/incidents/:id', deps.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });
    const before = incidents.get(req.params.id);
    if (!before) return res.status(404).json({ success: false, error: 'INCIDENT_NOT_FOUND' });
    if (!scoped(req.user, before)) return res.status(403).json({ success: false, error: 'INCIDENT_SCOPE_DENIED' });
    const action = String(req.body?.action || '').toUpperCase();
    const actor = String(req.user.fullName || req.user.id);
    try {
      let incident;
      if (action === 'ACKNOWLEDGE') incident = incidents.acknowledge(before.id, actor);
      else if (action === 'ESCALATE') {
        if (!ESCALATE_ROLES.has(req.user.role)) return res.status(403).json({ success: false, error: 'INCIDENT_ESCALATE_DENIED' });
        incident = incidents.escalate(before.id, actor);
      } else if (action === 'RESOLVE') {
        if (!RESOLVE_ROLES.has(req.user.role)) return res.status(403).json({ success: false, error: 'INCIDENT_RESOLVE_DENIED' });
        incident = incidents.resolve(before.id, actor, String(req.body?.note || ''));
      } else return res.status(400).json({ success: false, error: 'INCIDENT_ACTION_INVALID' });
      const audit = deps.auditFromOperation(req, { module: 'dashboard', action: action === 'RESOLVE' ? 'approve' : 'edit', entity: 'OperationalIncident', entityId: incident.id }, JSON.stringify(before), JSON.stringify(incident));
      if (audit) deps.store.appendAuditLog(audit);
      return res.json({ success: true, incident });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'INCIDENT_UPDATE_FAILED';
      return res.status(code.includes('NOT_FOUND') ? 404 : 422).json({ success: false, error: code });
    }
  });
}
