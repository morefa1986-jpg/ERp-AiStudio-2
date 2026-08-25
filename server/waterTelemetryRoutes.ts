import type { Express, Request, Response } from 'express';
import { fetchDahirTelemetryServerSide } from './dahirGateway';
import { rowWithinUserScope } from './stateScope';
import { StateConflictError, StoredAuditLog } from './storage';
import { buildAuthoritativeWaterMutation, validateWaterTelemetryMappingInput, WaterTelemetryMappingStore } from './waterTelemetryIngestion';
import { validateMutationScope, validateStateMutation, validateStateSnapshot } from '../src/utils/stateIntegrity';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; fullName?: string; hallScope?: string[]; pondScope?: string[]; [key: string]: unknown };
}

interface StateEnvelope {
  version: number;
  data: Record<string, unknown>;
}

interface Dependencies {
  requireAuth: any;
  requireAdmin: any;
  store: {
    getState(): StateEnvelope | null | undefined;
    saveStateAndAudit(data: Record<string, unknown>, expectedVersion: number | null, audit: StoredAuditLog): StateEnvelope;
    appendAuditLog(log: StoredAuditLog): void;
  };
  filterStateForUser: (data: Record<string, unknown>, user: any) => Record<string, unknown>;
  auditFromOperation: (req: any, operation: any, beforeState?: string, afterState?: string) => StoredAuditLog | null;
}

const INGEST_ROLES = new Set(['Super Admin', 'Farm Owner', 'Farm Manager', 'Hall Manager', 'Technician', 'Laboratory', 'Veterinarian']);

function gatewayStatus(code: string): number {
  if (code === 'DAHIR_TIMEOUT') return 504;
  if (code === 'DAHIR_NOT_CONFIGURED' || code === 'DAHIR_SERVER_CREDENTIAL_REQUIRED') return 503;
  if (code === 'DAHIR_DEVICE_INVALID' || code === 'DAHIR_KEYS_INVALID') return 400;
  return 502;
}

export function registerWaterTelemetryRoutes(app: Express, deps: Dependencies): void {
  const mappings = new WaterTelemetryMappingStore();

  app.get('/api/water-telemetry/mappings', deps.requireAuth, deps.requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    return res.json({ success: true, mappings: mappings.list() });
  });

  app.post('/api/water-telemetry/mappings', deps.requireAuth, deps.requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const validation = validateWaterTelemetryMappingInput(req.body);
    if (validation.ok === false) return res.status(400).json({ success: false, error: validation.error });
    const state = deps.store.getState();
    if (!state) return res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' });
    const pond = Array.isArray(state.data.ponds) ? (state.data.ponds as any[]).find((row) => row?.id === validation.pondId && row?.isActive !== false) : undefined;
    if (!pond) return res.status(400).json({ success: false, error: 'WATER_MAPPING_POND_NOT_ACTIVE' });
    try {
      const mapping = mappings.create(validation);
      const audit = deps.auditFromOperation(req, { module: 'settings', action: 'manage', entity: 'WaterTelemetryMapping', entityId: mapping.id }, undefined, JSON.stringify(mapping));
      if (audit) deps.store.appendAuditLog(audit);
      return res.status(201).json({ success: true, mapping });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'WATER_MAPPING_CREATE_FAILED';
      return res.status(code === 'WATER_MAPPING_POND_ALREADY_MAPPED' ? 409 : 500).json({ success: false, error: code });
    }
  });

  app.patch('/api/water-telemetry/mappings/:id', deps.requireAuth, deps.requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    if (typeof req.body?.isActive !== 'boolean') return res.status(400).json({ success: false, error: 'WATER_MAPPING_ACTIVE_REQUIRED' });
    const before = mappings.get(req.params.id);
    if (!before) return res.status(404).json({ success: false, error: 'WATER_MAPPING_NOT_FOUND' });
    try {
      const mapping = mappings.setActive(req.params.id, req.body.isActive);
      if (!mapping) return res.status(404).json({ success: false, error: 'WATER_MAPPING_NOT_FOUND' });
      const audit = deps.auditFromOperation(req, { module: 'settings', action: 'manage', entity: 'WaterTelemetryMapping', entityId: mapping.id }, JSON.stringify(before), JSON.stringify(mapping));
      if (audit) deps.store.appendAuditLog(audit);
      return res.json({ success: true, mapping });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'WATER_MAPPING_UPDATE_FAILED';
      return res.status(code === 'WATER_MAPPING_POND_ALREADY_MAPPED' ? 409 : 500).json({ success: false, error: code });
    }
  });

  app.post('/api/water-telemetry/ingest/:mappingId', deps.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || !INGEST_ROLES.has(req.user.role)) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const mapping = mappings.get(req.params.mappingId);
    if (!mapping || !mapping.isActive) return res.status(404).json({ success: false, error: 'WATER_MAPPING_NOT_ACTIVE' });
    const previous = deps.store.getState();
    if (!previous) return res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' });
    const pond = Array.isArray(previous.data.ponds) ? (previous.data.ponds as any[]).find((row) => row?.id === mapping.pondId) : undefined;
    if (!pond || !rowWithinUserScope('ponds', pond, previous.data, req.user)) return res.status(403).json({ success: false, error: 'STATE_SCOPE_VIOLATION:ponds' });

    let points;
    try {
      points = await fetchDahirTelemetryServerSide(mapping.deviceId, Object.values(mapping.keys));
    } catch (error) {
      const code = error instanceof Error ? error.message : 'DAHIR_GATEWAY_FAILED';
      return res.status(gatewayStatus(code)).json({ success: false, error: code });
    }

    const mutation = buildAuthoritativeWaterMutation(previous.data, mapping, points, String(req.user.fullName || req.user.id));
    if (!mutation.ok || !mutation.state || !mutation.log) return res.status(422).json({ success: false, error: mutation.error || 'WATER_TELEMETRY_INGESTION_FAILED' });
    const snapshot = validateStateSnapshot(mutation.state);
    if (!snapshot.ok) return res.status(422).json({ success: false, error: snapshot.error });
    const operation = { module: 'water_quality', action: 'create', entity: 'WaterQualityLog', entityId: String(mutation.log.id) };
    const invariant = validateStateMutation(previous.data, mutation.state, operation);
    if (!invariant.ok) return res.status(422).json({ success: false, error: invariant.error });
    const mutationScope = validateMutationScope(previous.data, mutation.state, operation);
    if (!mutationScope.ok) return res.status(422).json({ success: false, error: mutationScope.error });
    const audit = deps.auditFromOperation(req, operation, undefined, JSON.stringify(mutation.log));
    if (!audit) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });
    try {
      const saved = deps.store.saveStateAndAudit(mutation.state, previous.version, audit);
      return res.json({ success: true, log: mutation.log, state: { ...saved, data: deps.filterStateForUser(saved.data, req.user) } });
    } catch (error) {
      if (error instanceof StateConflictError) {
        return res.status(409).json({ success: false, error: 'STATE_VERSION_CONFLICT', state: { ...error.current, data: deps.filterStateForUser(error.current.data, req.user) } });
      }
      return res.status(500).json({ success: false, error: 'WATER_TELEMETRY_SAVE_FAILED' });
    }
  });
}
