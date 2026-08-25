import { getStoredSessionToken } from '../context/AuthContext';

export type ColdStorageEventType = 'MOVE' | 'TEMPERATURE_CHECK' | 'QUALITY_HOLD' | 'RELEASE' | 'CYCLE_COUNT';

export interface ColdStorageEventRecord {
  id: string;
  palletId: string;
  batchCode: string;
  eventType: ColdStorageEventType;
  timestamp: string;
  actor: string;
  notes: string;
  previousSlotCode?: string;
  nextSlotCode?: string;
  temperatureC?: number;
  minAllowedC?: number;
  maxAllowedC?: number;
  withinRange?: boolean;
  previousUnitsCount?: number;
  nextUnitsCount?: number;
  previousWeightKg?: number;
  nextWeightKg?: number;
  reason?: string;
}

function headers(): HeadersInit {
  const token = getStoredSessionToken();
  return { Authorization: `Bearer ${token || ''}`, 'Content-Type': 'application/json' };
}

async function call(path: string, body?: Record<string, unknown>): Promise<any> {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.error || 'COLD_STORAGE_REQUEST_FAILED');
  return payload;
}

export async function listColdStorageEvents(palletId?: string): Promise<ColdStorageEventRecord[]> {
  const query = palletId ? `?palletId=${encodeURIComponent(palletId)}` : '';
  const payload = await call(`/api/cold-storage/events${query}`);
  return Array.isArray(payload.events) ? payload.events : [];
}

export const moveColdStoragePallet = (id: string, input: { slotCode: string; notes?: string }) => call(`/api/cold-storage/${encodeURIComponent(id)}/move`, input);
export const recordColdStorageTemperature = (id: string, input: { temperatureC: number; minAllowedC: number; maxAllowedC: number; notes?: string }) => call(`/api/cold-storage/${encodeURIComponent(id)}/temperature-check`, input);
export const holdColdStoragePallet = (id: string, input: { reason: string; notes?: string }) => call(`/api/cold-storage/${encodeURIComponent(id)}/hold`, input);
export const releaseColdStoragePallet = (id: string, input: { reason: string; notes?: string }) => call(`/api/cold-storage/${encodeURIComponent(id)}/release`, input);
export const cycleCountColdStoragePallet = (id: string, input: { unitsCount: number; weightKg: number; reason: string; notes?: string }) => call(`/api/cold-storage/${encodeURIComponent(id)}/cycle-count`, input);
