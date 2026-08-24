import type { Express, Request } from 'express';
import { MaintenancePartUsage, MaintenancePriority, MaintenanceStore, MaintenanceWorkOrderType } from './maintenanceStore';
import { StoredAuditLog } from './storage';
import { maintenanceRoleAllows, MaintenanceAction } from '../src/utils/maintenanceAccess';

interface AuthenticatedRequest extends Request {
  user?: { id: string; fullName?: string; username?: string; role: string; [key: string]: unknown };
}
interface StateEnvelope { version: number; data: Record<string, unknown>; }
interface Dependencies {
  requireAuth: any;
  store: { getState(): StateEnvelope | null | undefined; appendAuditLog(log: StoredAuditLog): void };
  auditFromOperation: (req: any, operation: any, beforeState?: string, afterState?: string) => StoredAuditLog | null;
}
const TYPES = new Set<MaintenanceWorkOrderType>(['Preventive', 'Corrective', 'Inspection', 'Emergency']);
const PRIORITIES = new Set<MaintenancePriority>(['Low', 'Normal', 'High', 'Critical']);
function clean(value: unknown, max: number): string { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function actor(req: AuthenticatedRequest): string { return clean(req.user?.fullName || req.user?.username || req.user?.id || 'operator', 200); }
function allowed(req: AuthenticatedRequest, action: MaintenanceAction): boolean { return Boolean(req.user && maintenanceRoleAllows(req.user.role, action)); }
function errorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : 'MAINTENANCE_REQUEST_FAILED';
  if (message.includes('NOT_FOUND')) return 404;
  if (message.includes('NOT_OPEN') || message.includes('NOT_IN_PROGRESS') || message.includes('FINALIZED')) return 409;
  if (message.includes('UNIQUE') || message.includes('constraint')) return 409;
  return 400;
}

export function registerMaintenanceRoutes(app: Express, deps: Dependencies): void {
  const store = new MaintenanceStore();
  const audit = (req: AuthenticatedRequest, action: string, id: string, after?: unknown, before?: unknown) => {
    const log = deps.auditFromOperation(req, { module: 'settings', action: action === 'create' ? 'create' : action === 'approve' ? 'approve' : 'edit', entity: 'MaintenanceWorkOrder', entityId: id }, before ? JSON.stringify(before) : undefined, after ? JSON.stringify(after) : undefined);
    if (log) deps.store.appendAuditLog(log);
  };

  app.get('/api/maintenance/work-orders', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'view')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    return res.json({ success: true, workOrders: store.list(Number(req.query.limit) || 500) });
  });

  app.get('/api/maintenance/work-orders/:id/events', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'view')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    return res.json({ success: true, events: store.events(req.params.id, Number(req.query.limit) || 200) });
  });

  app.post('/api/maintenance/work-orders', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'create')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const state = deps.store.getState();
    if (!state) return res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' });
    const equipmentId = clean(req.body?.equipmentId, 160);
    const equipment = (Array.isArray(state.data.equipment) ? state.data.equipment as any[] : []).find((row) => row.id === equipmentId);
    if (!equipment) return res.status(404).json({ success: false, error: 'EQUIPMENT_NOT_FOUND' });
    const type = clean(req.body?.type, 40) as MaintenanceWorkOrderType;
    const priority = clean(req.body?.priority, 40) as MaintenancePriority;
    if (!TYPES.has(type) || !PRIORITIES.has(priority)) return res.status(400).json({ success: false, error: 'MAINTENANCE_TYPE_PRIORITY_INVALID' });
    try {
      const workOrder = store.create({
        code: clean(req.body?.code, 100), equipmentId, equipmentCode: String(equipment.code || equipment.id), equipmentName: String(equipment.name || equipment.code || equipment.id),
        type, priority, description: clean(req.body?.description, 2000), assignedTechnician: clean(req.body?.assignedTechnician, 200), plannedDate: clean(req.body?.plannedDate, 10), createdBy: actor(req),
        failureReason: clean(req.body?.failureReason, 1000) || undefined,
      });
      audit(req, 'create', workOrder.id, workOrder);
      return res.status(201).json({ success: true, workOrder });
    } catch (error) { return res.status(errorStatus(error)).json({ success: false, error: error instanceof Error ? error.message : 'MAINTENANCE_CREATE_FAILED' }); }
  });

  app.post('/api/maintenance/work-orders/:id/start', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'edit')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const before = store.get(req.params.id);
    try {
      const workOrder = store.start(req.params.id, actor(req));
      audit(req, 'edit', workOrder.id, workOrder, before);
      return res.json({ success: true, workOrder });
    } catch (error) { return res.status(errorStatus(error)).json({ success: false, error: error instanceof Error ? error.message : 'MAINTENANCE_START_FAILED' }); }
  });

  app.post('/api/maintenance/work-orders/:id/complete', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'approve')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const before = store.get(req.params.id);
    const rawParts = Array.isArray(req.body?.parts) ? req.body.parts : [];
    const parts: MaintenancePartUsage[] = rawParts.map((row: any) => ({ name: clean(row?.name, 200), quantity: Number(row?.quantity), unit: clean(row?.unit, 50), unitCost: Number(row?.unitCost) }));
    try {
      const workOrder = store.complete(req.params.id, {
        actor: actor(req), resolution: clean(req.body?.resolution, 2000), downtimeHours: Number(req.body?.downtimeHours), laborCost: Number(req.body?.laborCost), parts,
        nextServiceDate: clean(req.body?.nextServiceDate, 10) || undefined,
      });
      audit(req, 'approve', workOrder.id, workOrder, before);
      return res.json({ success: true, workOrder });
    } catch (error) { return res.status(errorStatus(error)).json({ success: false, error: error instanceof Error ? error.message : 'MAINTENANCE_COMPLETE_FAILED' }); }
  });

  app.post('/api/maintenance/work-orders/:id/cancel', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'approve')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const before = store.get(req.params.id);
    try {
      const workOrder = store.cancel(req.params.id, actor(req), clean(req.body?.reason, 1000));
      audit(req, 'approve', workOrder.id, workOrder, before);
      return res.json({ success: true, workOrder });
    } catch (error) { return res.status(errorStatus(error)).json({ success: false, error: error instanceof Error ? error.message : 'MAINTENANCE_CANCEL_FAILED' }); }
  });
}
