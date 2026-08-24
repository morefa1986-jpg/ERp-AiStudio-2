import { getStoredSessionToken } from '../context/AuthContext';

export type DahirAuthMode = 'server';

export interface DahirPondDeviceMapping {
  pondId: string;
  deviceId: string;
  levelKey: string;
  unit: string;
}

export interface DahirConfig {
  /** Kept only for migration/display compatibility. Dahir credentials and base URL are server-managed. */
  baseUrl: string;
  authMode: DahirAuthMode;
  pondDevices: DahirPondDeviceMapping[];
  treatmentDeviceId: string;
  treatmentKeys: string[];
  pollSeconds: number;
}

export interface DahirGatewayStatus {
  configured: boolean;
  authMode: 'apiKey' | 'bearer' | 'none';
  host?: string;
  maxAgeMinutes: number;
}

export interface DahirTelemetryPoint {
  key: string;
  value: number | string | boolean | null;
  numericValue: number | null;
  ts: number;
  timestamp: string;
  ageMinutes: number;
  isFresh: boolean;
}

export interface DahirPondLevelReading {
  pondId: string;
  deviceId: string;
  key: string;
  unit: string;
  point?: DahirTelemetryPoint;
  error?: string;
}

const CONFIG_KEY = 'fathi_erp_dahir_mapping_v2';
export const DAHIR_MAX_DATA_AGE_MINUTES = 15;

export const DEFAULT_DAHIR_CONFIG: DahirConfig = {
  baseUrl: 'SERVER_MANAGED',
  authMode: 'server',
  pondDevices: [],
  treatmentDeviceId: '',
  treatmentKeys: ['temperature', 'dissolvedOxygen', 'ph', 'ammonia', 'nitrite', 'tds', 'turbidity', 'orp', 'conductivity', 'flowRate', 'waterLevel'],
  pollSeconds: 30,
};

function sessionHeaders(): HeadersInit {
  const token = getStoredSessionToken();
  if (!token) throw new Error('AUTH_REQUIRED');
  return { Accept: 'application/json', Authorization: `Bearer ${token}` };
}

export function loadDahirConfig(): DahirConfig {
  try {
    if (typeof window === 'undefined') return DEFAULT_DAHIR_CONFIG;
    const raw = window.localStorage.getItem(CONFIG_KEY) || window.localStorage.getItem('fathi_erp_dahir_config_v1');
    if (!raw) return DEFAULT_DAHIR_CONFIG;
    const parsed = JSON.parse(raw) as Partial<DahirConfig>;
    return {
      ...DEFAULT_DAHIR_CONFIG,
      pondDevices: Array.isArray(parsed.pondDevices)
        ? parsed.pondDevices
          .filter((row): row is DahirPondDeviceMapping => Boolean(row?.pondId && row?.deviceId))
          .map((row) => ({ pondId: String(row.pondId), deviceId: String(row.deviceId), levelKey: String(row.levelKey || 'waterLevel'), unit: String(row.unit || 'cm') }))
        : [],
      treatmentDeviceId: String(parsed.treatmentDeviceId || ''),
      treatmentKeys: Array.isArray(parsed.treatmentKeys) && parsed.treatmentKeys.length ? parsed.treatmentKeys.map(String).map((key) => key.trim()).filter(Boolean) : DEFAULT_DAHIR_CONFIG.treatmentKeys,
      pollSeconds: Math.max(10, Math.min(300, Number(parsed.pollSeconds || DEFAULT_DAHIR_CONFIG.pollSeconds))),
      baseUrl: 'SERVER_MANAGED',
      authMode: 'server',
    };
  } catch {
    return DEFAULT_DAHIR_CONFIG;
  }
}

export function saveDahirConfig(config: DahirConfig): DahirConfig {
  const sanitized: DahirConfig = {
    ...DEFAULT_DAHIR_CONFIG,
    pondDevices: config.pondDevices.map((row) => ({
      pondId: String(row.pondId).trim(), deviceId: String(row.deviceId).trim(), levelKey: String(row.levelKey || 'waterLevel').trim(), unit: String(row.unit || 'cm').trim(),
    })).filter((row) => row.pondId && row.deviceId),
    treatmentDeviceId: String(config.treatmentDeviceId || '').trim(),
    treatmentKeys: config.treatmentKeys.map((key) => key.trim()).filter(Boolean),
    pollSeconds: Math.max(10, Math.min(300, Number(config.pollSeconds || 30))),
    baseUrl: 'SERVER_MANAGED',
    authMode: 'server',
  };
  if (typeof window !== 'undefined') window.localStorage.setItem(CONFIG_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export async function fetchDahirGatewayStatus(): Promise<DahirGatewayStatus> {
  const response = await fetch('/api/dahir/status', { headers: sessionHeaders() });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.error || 'DAHIR_GATEWAY_STATUS_FAILED');
  return payload.gateway as DahirGatewayStatus;
}

export async function fetchDahirLatestTelemetry(_baseUrl: string, deviceId: string, keys: string[]): Promise<Record<string, DahirTelemetryPoint>> {
  const device = String(deviceId || '').trim();
  const uniqueKeys = [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
  if (!device) throw new Error('DAHIR_DEVICE_REQUIRED');
  if (!uniqueKeys.length) throw new Error('DAHIR_KEYS_REQUIRED');
  const response = await fetch(`/api/dahir/telemetry/${encodeURIComponent(device)}?keys=${encodeURIComponent(uniqueKeys.join(','))}`, { headers: sessionHeaders() });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) throw new Error(payload.error || 'DAHIR_GATEWAY_READ_FAILED');
  return payload.points as Record<string, DahirTelemetryPoint>;
}

export async function fetchDahirPondLevels(config: DahirConfig): Promise<DahirPondLevelReading[]> {
  return Promise.all(config.pondDevices.map(async (mapping) => {
    try {
      const key = mapping.levelKey || 'waterLevel';
      const data = await fetchDahirLatestTelemetry(config.baseUrl, mapping.deviceId, [key]);
      return { ...mapping, key, point: data[key] };
    } catch (error) {
      return { ...mapping, key: mapping.levelKey || 'waterLevel', error: error instanceof Error ? error.message : 'DAHIR_LEVEL_READ_FAILED' };
    }
  }));
}

export async function fetchDahirTreatmentPlant(config: DahirConfig): Promise<Record<string, DahirTelemetryPoint>> {
  if (!config.treatmentDeviceId.trim()) throw new Error('DAHIR_TREATMENT_DEVICE_REQUIRED');
  return fetchDahirLatestTelemetry(config.baseUrl, config.treatmentDeviceId, config.treatmentKeys);
}
