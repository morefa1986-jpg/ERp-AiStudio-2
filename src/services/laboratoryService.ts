import { getStoredSessionToken } from '../context/AuthContext';

export interface LaboratoryEventRecord {
  id: string;
  sampleId: string;
  sampleCode: string;
  eventType: 'SAMPLE_CREATED' | 'RESULTS_RECORDED' | 'APPROVED' | 'REJECTED';
  timestamp: string;
  actor: string;
  notes: string;
  criticalCount?: number;
}

function headers(): HeadersInit {
  return { Authorization: `Bearer ${getStoredSessionToken() || ''}`, 'Content-Type': 'application/json' };
}

async function call(path: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: Record<string, unknown>): Promise<any> {
  const response = await fetch(path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.error || 'LABORATORY_REQUEST_FAILED');
  return payload;
}

export const createLaboratorySample = (input: Record<string, unknown>) => call('/api/laboratory/samples', 'POST', input);
export const recordLaboratoryResults = (id: string, input: Record<string, unknown>) => call(`/api/laboratory/samples/${encodeURIComponent(id)}/results`, 'PATCH', input);
export const approveLaboratorySample = (id: string, notes?: string) => call(`/api/laboratory/samples/${encodeURIComponent(id)}/approve`, 'POST', { notes });
export const rejectLaboratorySample = (id: string, reason: string) => call(`/api/laboratory/samples/${encodeURIComponent(id)}/reject`, 'POST', { reason });
export async function listLaboratoryEvents(sampleId?: string): Promise<LaboratoryEventRecord[]> {
  const payload = await call(`/api/laboratory/events${sampleId ? `?sampleId=${encodeURIComponent(sampleId)}` : ''}`);
  return Array.isArray(payload.events) ? payload.events : [];
}
