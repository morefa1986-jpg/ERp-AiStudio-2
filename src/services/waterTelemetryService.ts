import { getStoredSessionToken } from '../context/AuthContext';

export interface WaterTelemetryKeyMap {
  dissolvedOxygen: string;
  temperature: string;
  ph: string;
  ammonia: string;
  nitrite: string;
}

export interface WaterTelemetryMapping {
  id: string;
  pondId: string;
  deviceId: string;
  keys: WaterTelemetryKeyMap;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function headers(): HeadersInit {
  const token = getStoredSessionToken();
  if (!token) throw new Error('AUTH_REQUIRED');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function jsonRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.error || 'WATER_TELEMETRY_REQUEST_FAILED');
  return payload as T;
}

export async function listWaterTelemetryMappings(): Promise<WaterTelemetryMapping[]> {
  const payload = await jsonRequest<{ success: true; mappings: WaterTelemetryMapping[] }>('/api/water-telemetry/mappings');
  return Array.isArray(payload.mappings) ? payload.mappings : [];
}

export async function createWaterTelemetryMapping(input: { pondId: string; deviceId: string; keys: WaterTelemetryKeyMap }): Promise<WaterTelemetryMapping> {
  const payload = await jsonRequest<{ success: true; mapping: WaterTelemetryMapping }>('/api/water-telemetry/mappings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return payload.mapping;
}

export async function setWaterTelemetryMappingActive(id: string, isActive: boolean): Promise<WaterTelemetryMapping> {
  const payload = await jsonRequest<{ success: true; mapping: WaterTelemetryMapping }>(`/api/water-telemetry/mappings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
  return payload.mapping;
}

export async function ingestWaterTelemetryMapping(id: string): Promise<{ log: Record<string, unknown>; state: { version: number; data: Record<string, unknown> } }> {
  return jsonRequest(`/api/water-telemetry/ingest/${encodeURIComponent(id)}`, { method: 'POST', body: '{}' });
}
