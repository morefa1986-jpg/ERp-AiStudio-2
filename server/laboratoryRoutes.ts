import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import { LaboratoryLedgerStore } from './laboratoryLedger';
import { StateConflictError, StoredAuditLog } from './storage';
import { roleAllows } from '../src/utils/rbac';
import { validateStateSnapshot } from '../src/utils/stateIntegrity';

interface AuthenticatedRequest extends Request {
  user?: { id: string; fullName?: string; username?: string; role: string; [key: string]: unknown };
}
interface StateEnvelope { version: number; data: Record<string, unknown>; }
interface LaboratoryStore { getState(): StateEnvelope | null | undefined; saveStateAndAudit(data: Record<string, unknown>, expectedVersion: number | null, audit: StoredAuditLog): StateEnvelope; }
interface Dependencies {
  requireAuth: any;
  store: LaboratoryStore;
  filterStateForUser: (data: Record<string, unknown>, user: any) => Record<string, unknown>;
  auditFromOperation: (req: any, operation: any, beforeState?: string, afterState?: string) => StoredAuditLog | null;
}

const SOURCE_TYPES = new Set(['Pond', 'Fish Tissue', 'Water Supply', 'Egg/Caviar', 'Feed Batch']);
const TEST_TYPES = new Set(['Water Chemistry', 'Microbiology & Bacterial', 'Parasitology', 'Histology', 'Caviar Heavy Metals & Microbiology']);
const PARAMETER_STATUSES = new Set(['Normal', 'Abnormal', 'Critical']);
function clean(value: unknown, max: number): string { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function actor(req: AuthenticatedRequest): string { return clean(req.user?.fullName || req.user?.username || req.user?.id || 'operator', 200); }
function validDate(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime()); }

export function registerLaboratoryRoutes(app: Express, deps: Dependencies): void {
  const ledger = new LaboratoryLedgerStore();
  const allowed = (req: AuthenticatedRequest, action: 'view' | 'create' | 'edit' | 'approve') => Boolean(req.user && roleAllows(req.user.role, 'laboratory', action));
  const current = (res: Response): StateEnvelope | null => { const state = deps.store.getState(); if (!state) { res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' }); return null; } return state; };
  const samples = (state: StateEnvelope): any[] => Array.isArray(state.data.labSamples) ? state.data.labSamples as any[] : [];

  const commit = (req: AuthenticatedRequest, res: Response, previous: StateEnvelope, nextSample: any, action: 'create' | 'edit' | 'approve', eventType: 'SAMPLE_CREATED' | 'RESULTS_RECORDED' | 'APPROVED' | 'REJECTED', notes: string) => {
    const exists = samples(previous).some((row) => row.id === nextSample.id);
    const nextSamples = exists ? samples(previous).map((row) => row.id === nextSample.id ? nextSample : row) : [nextSample, ...samples(previous)];
    const next = { ...previous.data, labSamples: nextSamples };
    const snapshot = validateStateSnapshot(next);
    if (!snapshot.ok) return res.status(422).json({ success: false, error: snapshot.error });
    const before = exists ? samples(previous).find((row) => row.id === nextSample.id) : undefined;
    const audit = deps.auditFromOperation(req, { module: 'laboratory', action, entity: 'LabSample', entityId: nextSample.id }, before ? JSON.stringify(before) : undefined, JSON.stringify(nextSample));
    if (!audit) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });
    try {
      const saved = deps.store.saveStateAndAudit(next, previous.version, audit);
      try { ledger.append({ sampleId: nextSample.id, sampleCode: nextSample.sampleCode, eventType, actor: actor(req), notes, criticalCount: Array.isArray(nextSample.parametersTested) ? nextSample.parametersTested.filter((row: any) => row?.status === 'Critical').length : 0 }); } catch { /* canonical audit already persisted */ }
      return res.json({ success: true, sample: nextSample, state: { ...saved, data: deps.filterStateForUser(saved.data, req.user) } });
    } catch (error) {
      if (error instanceof StateConflictError) return res.status(409).json({ success: false, error: 'STATE_VERSION_CONFLICT', state: { ...error.current, data: deps.filterStateForUser(error.current.data, req.user) } });
      return res.status(500).json({ success: false, error: 'LAB_SAMPLE_SAVE_FAILED' });
    }
  };

  app.get('/api/laboratory/events', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'view')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    return res.json({ success: true, events: ledger.list(Number(req.query.limit) || 500, clean(req.query.sampleId, 160) || undefined) });
  });

  app.post('/api/laboratory/samples', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'create')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const previous = current(res); if (!previous) return;
    const sampleCode = clean(req.body?.sampleCode, 120);
    const sourceType = clean(req.body?.sourceType, 80);
    const sourceId = clean(req.body?.sourceId, 160);
    let sourceName = clean(req.body?.sourceName, 200);
    const collectionDate = clean(req.body?.collectionDate, 10);
    const collectorName = clean(req.body?.collectorName, 200) || actor(req);
    const testType = clean(req.body?.testType, 160);
    if (!sampleCode || !SOURCE_TYPES.has(sourceType) || !validDate(collectionDate) || !TEST_TYPES.has(testType)) return res.status(400).json({ success: false, error: 'LAB_SAMPLE_FIELDS_INVALID' });
    if (samples(previous).some((row) => String(row.sampleCode).toUpperCase() === sampleCode.toUpperCase())) return res.status(409).json({ success: false, error: 'LAB_SAMPLE_CODE_DUPLICATE' });
    if (sourceType === 'Pond') {
      const visible = deps.filterStateForUser(previous.data, req.user);
      const visiblePonds = Array.isArray(visible.ponds) ? visible.ponds as any[] : [];
      const pond = visiblePonds.find((row) => row.id === sourceId);
      if (!pond) return res.status(403).json({ success: false, error: 'LAB_SAMPLE_POND_SCOPE_DENIED' });
      sourceName = String(pond.name || pond.number || pond.id);
    } else if (!sourceName) return res.status(400).json({ success: false, error: 'LAB_SAMPLE_SOURCE_REQUIRED' });
    const now = new Date().toISOString();
    const sample = {
      id: `lab_${crypto.randomUUID()}`, sampleCode, sourceType, sourceId: sourceId || undefined, sourceName, collectionDate, collectorName, testType,
      parametersTested: [], resultSummary: '', status: 'Pending', attachmentUrl: clean(req.body?.attachmentUrl, 1000) || undefined,
      createdAt: now, createdBy: actor(req),
    };
    return commit(req, res, previous, sample, 'create', 'SAMPLE_CREATED', 'Sample registered');
  });

  app.patch('/api/laboratory/samples/:id/results', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'edit')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const previous = current(res); if (!previous) return;
    const found = samples(previous).find((row) => row.id === req.params.id);
    if (!found) return res.status(404).json({ success: false, error: 'LAB_SAMPLE_NOT_FOUND' });
    if (found.status !== 'Pending') return res.status(409).json({ success: false, error: 'LAB_SAMPLE_FINALIZED' });
    const rawParameters = Array.isArray(req.body?.parametersTested) ? req.body.parametersTested : [];
    if (!rawParameters.length || rawParameters.length > 100) return res.status(400).json({ success: false, error: 'LAB_PARAMETERS_REQUIRED' });
    const parameters = rawParameters.map((row: any) => ({
      name: clean(row?.name, 160),
      value: typeof row?.value === 'number' && Number.isFinite(row.value) ? row.value : clean(row?.value, 200),
      unit: clean(row?.unit, 80) || undefined,
      referenceRange: clean(row?.referenceRange, 200),
      status: clean(row?.status, 20),
    }));
    if (parameters.some((row: any) => !row.name || row.value === '' || !row.referenceRange || !PARAMETER_STATUSES.has(row.status))) return res.status(400).json({ success: false, error: 'LAB_PARAMETER_INVALID' });
    const resultSummary = clean(req.body?.resultSummary, 2000);
    if (!resultSummary) return res.status(400).json({ success: false, error: 'LAB_RESULT_SUMMARY_REQUIRED' });
    const nextSample = { ...found, parametersTested: parameters, resultSummary, attachmentUrl: clean(req.body?.attachmentUrl, 1000) || found.attachmentUrl, resultRecordedAt: new Date().toISOString(), resultRecordedBy: actor(req) };
    return commit(req, res, previous, nextSample, 'edit', 'RESULTS_RECORDED', resultSummary);
  });

  app.post('/api/laboratory/samples/:id/approve', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'approve')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const previous = current(res); if (!previous) return;
    const found = samples(previous).find((row) => row.id === req.params.id);
    if (!found) return res.status(404).json({ success: false, error: 'LAB_SAMPLE_NOT_FOUND' });
    if (found.status !== 'Pending') return res.status(409).json({ success: false, error: 'LAB_SAMPLE_FINALIZED' });
    if (!Array.isArray(found.parametersTested) || !found.parametersTested.length || !String(found.resultSummary || '').trim()) return res.status(409).json({ success: false, error: 'LAB_RESULTS_REQUIRED_BEFORE_APPROVAL' });
    const nextSample = { ...found, status: 'Approved', approvedBy: actor(req), approvedAt: new Date().toISOString() };
    return commit(req, res, previous, nextSample, 'approve', 'APPROVED', clean(req.body?.notes, 1000) || 'Result verified');
  });

  app.post('/api/laboratory/samples/:id/reject', deps.requireAuth, (req: AuthenticatedRequest, res) => {
    if (!allowed(req, 'approve')) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const previous = current(res); if (!previous) return;
    const found = samples(previous).find((row) => row.id === req.params.id);
    if (!found) return res.status(404).json({ success: false, error: 'LAB_SAMPLE_NOT_FOUND' });
    if (found.status !== 'Pending') return res.status(409).json({ success: false, error: 'LAB_SAMPLE_FINALIZED' });
    const reason = clean(req.body?.reason, 1000);
    if (!reason) return res.status(400).json({ success: false, error: 'LAB_REJECTION_REASON_REQUIRED' });
    const nextSample = { ...found, status: 'Rejected', approvedBy: actor(req), rejectedAt: new Date().toISOString(), rejectionReason: reason };
    return commit(req, res, previous, nextSample, 'approve', 'REJECTED', reason);
  });
}
