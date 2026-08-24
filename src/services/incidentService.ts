import { getStoredSessionToken } from '../context/AuthContext';

export interface OperationalIncidentRecord {
  id: string; fingerprint: string; sourceType: 'WATER_QUALITY' | 'FEEDING' | 'INVENTORY'; entityId: string;
  pondId?: string; hallId?: string; severity: 'WARNING' | 'HIGH' | 'CRITICAL'; title: string; details: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'; escalationLevel: number; firstSeenAt: string; lastSeenAt: string;
  acknowledgedBy?: string; acknowledgedAt?: string; resolvedBy?: string; resolvedAt?: string; resolutionNote?: string;
  externalDispatchState: 'NOT_CONFIGURED';
}

function headers(): HeadersInit {
  const token = getStoredSessionToken(); if (!token) throw new Error('AUTH_REQUIRED');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.error || 'INCIDENT_REQUEST_FAILED');
  return payload as T;
}
export async function syncOperationalIncidents(): Promise<OperationalIncidentRecord[]> {
  const payload = await request<{ success: true; incidents: OperationalIncidentRecord[] }>('/api/incidents/sync', { method: 'POST', body: '{}' });
  return payload.incidents || [];
}
export async function updateOperationalIncident(id: string, action: 'ACKNOWLEDGE' | 'ESCALATE' | 'RESOLVE', note?: string): Promise<OperationalIncidentRecord> {
  const payload = await request<{ success: true; incident: OperationalIncidentRecord }>(`/api/incidents/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ action, note }) });
  return payload.incident;
}
export async function getIncidentCapabilities(): Promise<{ internalWorkflow: boolean; externalNotifications: { configured: boolean; sms: boolean; email: boolean } }> {
  return request('/api/incidents/capabilities');
}
