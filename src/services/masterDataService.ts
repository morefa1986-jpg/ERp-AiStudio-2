import { getStoredSessionToken } from '../context/AuthContext';

export type MasterDataEntity = Record<string, unknown>;
export interface MasterDataResponse {
  success: boolean;
  error?: string;
  entity?: MasterDataEntity;
  state?: { version: number; data: Record<string, unknown> };
}

async function masterRequest(path: string, method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<MasterDataResponse> {
  const token = getStoredSessionToken();
  if (!token) throw new Error('AUTH_REQUIRED');
  const response = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.error || 'MASTER_DATA_REQUEST_FAILED');
  return payload as MasterDataResponse;
}

export const createHallMaster = (input: Record<string, unknown>) => masterRequest('/api/master-data/halls', 'POST', input);
export const updateHallMaster = (id: string, input: Record<string, unknown>) => masterRequest(`/api/master-data/halls/${encodeURIComponent(id)}`, 'PATCH', input);
export const createPondMaster = (input: Record<string, unknown>) => masterRequest('/api/master-data/ponds', 'POST', input);
export const updatePondMaster = (id: string, input: Record<string, unknown>) => masterRequest(`/api/master-data/ponds/${encodeURIComponent(id)}`, 'PATCH', input);
export const createSpeciesMaster = (input: Record<string, unknown>) => masterRequest('/api/master-data/species', 'POST', input);
