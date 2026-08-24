import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import { StateConflictError, StoredAuditLog } from './storage';
import { validateMutationScope, validateStateMutation, validateStateSnapshot } from '../src/utils/stateIntegrity';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; fullName?: string; [key: string]: unknown };
}

interface StateEnvelope {
  version: number;
  data: Record<string, unknown>;
}

interface Dependencies {
  requireAuth: any;
  store: {
    getState(): StateEnvelope | null | undefined;
    saveStateAndAudit(data: Record<string, unknown>, expectedVersion: number | null, audit: StoredAuditLog): StateEnvelope;
  };
  filterStateForUser: (data: Record<string, unknown>, user: any) => Record<string, unknown>;
  auditFromOperation: (req: any, operation: any, beforeState?: string, afterState?: string) => StoredAuditLog | null;
}

const HR_WRITE_ROLES = new Set(['Super Admin', 'Farm Owner', 'Farm Manager', 'Accountant', 'HR Manager']);
const SHIFTS = new Set(['Morning (07:00 - 15:00)', 'Evening (15:00 - 23:00)', 'Night Watch (23:00 - 07:00)']);

function rows(state: Record<string, unknown>, key: string): any[] {
  return Array.isArray(state[key]) ? state[key] as any[] : [];
}

export function dateKeyForTimezoneOffset(timestamp: number, timezoneOffsetMinutes: number): string {
  return new Date(timestamp - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

export function buildAttendanceClockMutation(
  state: Record<string, unknown>,
  input: { employeeId: string; type: 'in' | 'out'; shift: string; timezoneOffsetMinutes: number },
  now = Date.now(),
): { ok: boolean; error?: string; state?: Record<string, unknown>; record?: Record<string, unknown> } {
  const employee = rows(state, 'employees').find((row) => row?.id === input.employeeId && row?.status === 'Active');
  if (!employee) return { ok: false, error: 'ATTENDANCE_EMPLOYEE_NOT_ACTIVE' };
  if (!SHIFTS.has(input.shift)) return { ok: false, error: 'ATTENDANCE_SHIFT_INVALID' };
  if (!Number.isInteger(input.timezoneOffsetMinutes) || Math.abs(input.timezoneOffsetMinutes) > 840) return { ok: false, error: 'ATTENDANCE_TIMEZONE_OFFSET_INVALID' };

  const attendance = rows(state, 'attendance');
  const openRows = attendance
    .filter((row) => row?.employeeId === input.employeeId && !row?.clockOutTime)
    .sort((a, b) => new Date(String(b.clockInTime || '')).getTime() - new Date(String(a.clockInTime || '')).getTime());

  if (input.type === 'in') {
    if (openRows.length) return { ok: false, error: 'ATTENDANCE_OPEN_SHIFT_EXISTS' };
    const record = {
      id: `att_${crypto.randomUUID()}`,
      employeeId: employee.id,
      employeeName: employee.fullName,
      date: dateKeyForTimezoneOffset(now, input.timezoneOffsetMinutes),
      clockInTime: new Date(now).toISOString(),
      shift: input.shift,
      regularHours: 0,
      overtimeHours: 0,
      status: 'Present',
    };
    return { ok: true, record, state: { ...state, attendance: [record, ...attendance] } };
  }

  const open = openRows[0];
  if (!open) return { ok: false, error: 'ATTENDANCE_OPEN_SHIFT_NOT_FOUND' };
  const started = new Date(String(open.clockInTime || '')).getTime();
  const hours = (now - started) / 3_600_000;
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return { ok: false, error: 'ATTENDANCE_DURATION_INVALID' };
  const record = {
    ...open,
    clockOutTime: new Date(now).toISOString(),
    regularHours: Number(Math.min(8, hours).toFixed(2)),
    overtimeHours: Number(Math.max(0, hours - 8).toFixed(2)),
  };
  return {
    ok: true,
    record,
    state: { ...state, attendance: attendance.map((row) => row?.id === open.id ? record : row) },
  };
}

export function registerHrAttendanceRoutes(app: Express, deps: Dependencies): void {
  app.post('/api/hr/attendance/clock', deps.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || !HR_WRITE_ROLES.has(req.user.role)) return res.status(403).json({ success: false, error: 'ACTION_NOT_ALLOWED' });
    const employeeId = typeof req.body?.employeeId === 'string' ? req.body.employeeId.trim() : '';
    const type = req.body?.type === 'out' ? 'out' : req.body?.type === 'in' ? 'in' : '';
    const shift = typeof req.body?.shift === 'string' ? req.body.shift : '';
    const timezoneOffsetMinutes = Number(req.body?.timezoneOffsetMinutes);
    if (!employeeId || !type) return res.status(400).json({ success: false, error: 'ATTENDANCE_INPUT_INVALID' });

    const previous = deps.store.getState();
    if (!previous) return res.status(409).json({ success: false, error: 'MASTER_STATE_NOT_INITIALIZED' });
    const mutation = buildAttendanceClockMutation(previous.data, { employeeId, type, shift, timezoneOffsetMinutes });
    if (!mutation.ok || !mutation.state || !mutation.record) return res.status(422).json({ success: false, error: mutation.error || 'ATTENDANCE_CLOCK_FAILED' });

    const snapshot = validateStateSnapshot(mutation.state);
    if (!snapshot.ok) return res.status(422).json({ success: false, error: snapshot.error });
    const operation = { module: 'hr', action: 'create', entity: 'Attendance', entityId: String(mutation.record.id) };
    const invariant = validateStateMutation(previous.data, mutation.state, operation);
    if (!invariant.ok) return res.status(422).json({ success: false, error: invariant.error });
    const scope = validateMutationScope(previous.data, mutation.state, operation);
    if (!scope.ok) return res.status(422).json({ success: false, error: scope.error });
    const audit = deps.auditFromOperation(req, operation, undefined, JSON.stringify(mutation.record));
    if (!audit) return res.status(401).json({ success: false, error: 'AUTH_REQUIRED' });

    try {
      const saved = deps.store.saveStateAndAudit(mutation.state, previous.version, audit);
      return res.json({ success: true, record: mutation.record, state: { ...saved, data: deps.filterStateForUser(saved.data, req.user) } });
    } catch (error) {
      if (error instanceof StateConflictError) return res.status(409).json({ success: false, error: 'STATE_VERSION_CONFLICT' });
      return res.status(500).json({ success: false, error: 'ATTENDANCE_SAVE_FAILED' });
    }
  });
}
