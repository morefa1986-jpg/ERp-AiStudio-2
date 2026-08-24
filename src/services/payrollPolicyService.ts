import { getStoredSessionToken } from '../context/AuthContext';
import { AttendanceRecord, Employee, PayrollRecord } from '../types';
import { generatePayrollDrafts, PayrollPolicy } from '../utils/payrollEngine';

type StatePayload = Record<string, unknown>;

function authHeaders(): HeadersInit {
  const token = getStoredSessionToken();
  if (!token) throw new Error('AUTH_REQUIRED');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function rows<T>(state: StatePayload, key: string): T[] { return Array.isArray(state[key]) ? state[key] as T[] : []; }

export async function generatePayrollDraftsOnServerState(policy: PayrollPolicy): Promise<PayrollRecord[]> {
  const getResponse = await fetch('/api/state', { headers: authHeaders() });
  const current = await getResponse.json().catch(() => ({}));
  if (!getResponse.ok || !current.success || !current.state?.data) throw new Error(current.error || 'STATE_LOAD_FAILED');
  const state = current.state.data as StatePayload;
  const employees = rows<Employee>(state, 'employees');
  const attendance = rows<AttendanceRecord>(state, 'attendance');
  const existingPayrolls = rows<PayrollRecord>(state, 'payrolls');
  const generated = generatePayrollDrafts(employees, attendance, policy);
  const nextState = {
    ...state,
    payrolls: [...generated, ...existingPayrolls.filter((row) => row.payrollMonth !== policy.payrollMonth)],
  };
  const putResponse = await fetch('/api/state', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      state: nextState,
      version: current.state.version,
      operation: { module: 'hr', action: 'create', entity: 'Payroll', entityId: policy.payrollMonth, referenceId: policy.payrollMonth },
    }),
  });
  const saved = await putResponse.json().catch(() => ({}));
  if (!putResponse.ok || !saved.success) throw new Error(saved.error || 'PAYROLL_SAVE_FAILED');
  return generated;
}
