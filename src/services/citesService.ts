import { getStoredSessionToken } from '../context/AuthContext';

export interface CitesPermitRecord {
  id: string; permitNumber: string; batchCode: string; speciesName: string; productScope: 'CAVIAR' | 'STURGEON_PRODUCT';
  destinationCountry?: string; issueDate: string; expiryDate: string; status: 'ACTIVE' | 'REVOKED' | 'SUSPENDED';
  issuerReference: string; notes: string; createdAt: string; updatedAt: string;
}

function headers(): HeadersInit {
  const token = getStoredSessionToken(); if (!token) throw new Error('AUTH_REQUIRED');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.error || 'CITES_REQUEST_FAILED');
  return payload as T;
}
export async function listCitesPermits(): Promise<CitesPermitRecord[]> {
  const payload = await request<{ success: true; permits: CitesPermitRecord[] }>('/api/cites/permits'); return payload.permits || [];
}
export async function createCitesPermit(input: Omit<CitesPermitRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<CitesPermitRecord> {
  const payload = await request<{ success: true; permit: CitesPermitRecord }>('/api/cites/permits', { method: 'POST', body: JSON.stringify(input) }); return payload.permit;
}
export async function setCitesPermitStatus(id: string, status: CitesPermitRecord['status']): Promise<CitesPermitRecord> {
  const payload = await request<{ success: true; permit: CitesPermitRecord }>(`/api/cites/permits/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }); return payload.permit;
}
export async function validateCitesPermit(input: { permitNumber: string; batchCode: string; destinationCountry?: string; shipmentDate: string }): Promise<CitesPermitRecord> {
  const payload = await request<{ success: true; valid: true; permit: CitesPermitRecord }>('/api/cites/validate', { method: 'POST', body: JSON.stringify(input) }); return payload.permit;
}
