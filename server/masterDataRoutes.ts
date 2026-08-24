import type { Express, Request, Response } from 'express';
import { createHallMaster, createPondMaster, createSpeciesMaster, MasterResult, updateHallMaster, updatePondMetadata } from './masterData';
import { StateConflictError, StoredAuditLog } from './storage';
import { validateStateSnapshot } from '../src/utils/stateIntegrity';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; [key: string]: unknown };
}

interface StateEnvelope {
  version: number;
  data: Record<string, unknown>;
}

interface MasterDataStore {
  getState(): StateEnvelope | null | undefined;
  saveStateAndAudit(data: Record<string, unknown>, expectedVersion: number | null, audit: StoredAuditLog): StateEnvelope;
}

/**
 * This module is an integration adapter around the server's existing auth/audit middleware.
 * Keep those dependency signatures intentionally structural so the adapter does not create
 * a second incompatible AuthenticatedRequest type. Runtime authorization is still enforced
 * by the canonical middleware supplied by server.ts.
 */
interface Dependencies {
  requireAuth: any;
  requireAdmin: any;
  store: MasterDataStore;
  synchronizeHallAggregates: (data: Record<string, unknown>, previous?: Record<string, unknown>) => Record<string, unknown>;
  filterStateForUser: (data: Record<string, unknown>, user: any) => Record<string, unknown>;
  auditFromOperation: (req: any, operation: any, beforeState?: string, afterState?: string) => StoredAuditLog | null;
}

function resultErrorStatus(error?: string): number {
  if (error?.endsWith('_NOT_FOUND')) return 404;
  if (error?.includes('DUPLICATE')) return 409;
  return 400;
}

export function registerMasterDataRoutes(app: Express, deps: Dependencies): void {
  const commit = (
    req: AuthenticatedRequest,
    res: Response,
    previous: StateEnvelope,
    result: MasterResult,
    operation: { action: 'create' | 'edit'; entity: string },
  ) => {
    if (!result.ok || !result.state || !result.entity) {
      return res.status(resultErrorStatus(result.error)).json({ success: false, error: result.error || 'MASTER_DATA_INVALID' });
    }
    const next = deps.synchronizeHallAggregates(result.state, previous.data);
    const snapshot = validateStateSnapshot(next);
    if (!snapshot.ok) return res.status(422).json({ success: false, error: snapshot.error });
    const entityId = String(result.entity.id || 'master');
    const audit = deps.auditFromOperation(
      req,
      { module: 'settings', action: operation.action, entity: operation.entity, entityId },
      operation.action === 'edit' ? JSON.stringify(previous.data) : undefined,
      JSON.stringify(result.entity),
    );
    if (!audit) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });
    try {
      const saved = deps.store.saveStateAndAudit(next, previous.version, audit);
      return res.json({ success: true, entity: result.entity, state: { ...saved, data: deps.filterStateForUser(saved.data, req.user) } });
    } catch (error) {
      if (error instanceof StateConflictError) {
        return res.status(409).json({ success: false, error: 'STATE_VERSION_CONFLICT', state: { ...error.current, data: deps.filterStateForUser(error.current.data, req.user) } });
      }
      return res.status(500).json({ success: false, error: 'MASTER_DATA_SAVE_FAILED' });
    }
  };

  const current = (res: Response): StateEnvelope | null => {
    const state = deps.store.getState();
    if (!state) {
      res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' });
      return null;
    }
    return state;
  };

  app.post('/api/master-data/halls', deps.requireAuth, deps.requireAdmin, (req: AuthenticatedRequest, res) => {
    const previous = current(res); if (!previous) return;
    return commit(req, res, previous, createHallMaster(previous.data, req.body), { action: 'create', entity: 'Hall' });
  });

  app.patch('/api/master-data/halls/:id', deps.requireAuth, deps.requireAdmin, (req: AuthenticatedRequest, res) => {
    const previous = current(res); if (!previous) return;
    return commit(req, res, previous, updateHallMaster(previous.data, req.params.id, req.body), { action: 'edit', entity: 'Hall' });
  });

  app.post('/api/master-data/ponds', deps.requireAuth, deps.requireAdmin, (req: AuthenticatedRequest, res) => {
    const previous = current(res); if (!previous) return;
    return commit(req, res, previous, createPondMaster(previous.data, req.body), { action: 'create', entity: 'Pond' });
  });

  app.patch('/api/master-data/ponds/:id', deps.requireAuth, deps.requireAdmin, (req: AuthenticatedRequest, res) => {
    const previous = current(res); if (!previous) return;
    return commit(req, res, previous, updatePondMetadata(previous.data, req.params.id, req.body), { action: 'edit', entity: 'Pond' });
  });

  app.post('/api/master-data/species', deps.requireAuth, deps.requireAdmin, (req: AuthenticatedRequest, res) => {
    const previous = current(res); if (!previous) return;
    return commit(req, res, previous, createSpeciesMaster(previous.data, req.body), { action: 'create', entity: 'Species' });
  });
}
