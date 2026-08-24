import type { Express, Request, Response } from 'express';
import { ModuleSettingsStore } from './moduleSettings';
import { StoredAuditLog } from './storage';
import { validateModuleVisibilityPayload } from '../src/utils/moduleVisibilityPolicy';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; [key: string]: unknown };
}

interface Dependencies {
  requireAuth: any;
  requireAdmin: any;
  auditFromOperation: (req: any, operation: any, beforeState?: string, afterState?: string) => StoredAuditLog | null;
  appendAuditLog: (log: StoredAuditLog) => void;
}

export function registerModuleSettingsRoutes(app: Express, deps: Dependencies): void {
  const settings = new ModuleSettingsStore();

  app.get('/api/admin/module-visibility', deps.requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    return res.json({ success: true, visibility: settings.getModuleVisibility(), source: 'server-sqlite' });
  });

  app.put('/api/admin/module-visibility', deps.requireAuth, deps.requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const validation = validateModuleVisibilityPayload(req.body?.visibility);
    if (!validation.ok) return res.status(400).json({ success: false, error: validation.error });
    const before = settings.getModuleVisibility();
    const visibility = settings.setModuleVisibility(validation.visibility);
    const audit = deps.auditFromOperation(
      req,
      { module: 'settings', action: 'manage', entity: 'ModuleVisibility', entityId: 'global' },
      JSON.stringify(before),
      JSON.stringify(visibility),
    );
    if (audit) deps.appendAuditLog(audit);
    return res.json({ success: true, visibility, source: 'server-sqlite' });
  });
}
