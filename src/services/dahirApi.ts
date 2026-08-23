export type DahirAuthMode = 'jwt' | 'apiKey';

export interface DahirPondDeviceMapping {
  pondId: string;
  deviceId: string;
  levelKey: string;
  unit: string;
}

export interface DahirConfig {
  baseUrl: string;
  authMode: DahirAuthMode;
  pondDevices: DahirPondDeviceMapping[];
  treatmentDeviceId: string;
  treatmentKeys: string[];
  pollSeconds: number;
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

const CONFIG_KEY = 'fathi_erp_dahir_config_v1';
const SESSION_AUTH_KEY = 'fathi_erp_dahir_auth_v1';
export const DAHIR_MAX_DATA_AGE_MINUTES = 15;

export const DEFAULT_DAHIR_CONFIG: DahirConfig = {
  baseUrl: 'http://dahir.local',
  authMode: 'jwt',
  pondDevices: [],
  treatmentDeviceId: '',
  treatmentKeys: [
    'temperature',
    'dissolvedOxygen',
    'ph',
    'ammonia',
    'nitrite',
    'tds',
    'turbidity',
    'orp',
    'conductivity',
    'flowRate',
    'waterLevel',
  ],
  pollSeconds: 30,
};

function normalizedBaseUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function loadDahirConfig(): DahirConfig {
  try {
    if (typeof window === 'undefined') return DEFAULT_DAHIR_CONFIG;
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_DAHIR_CONFIG;
    const parsed = JSON.parse(raw) as Partial<DahirConfig>;
    return {
      ...DEFAULT_DAHIR_CONFIG,
      ...parsed,
      baseUrl: normalizedBaseUrl(parsed.baseUrl || DEFAULT_DAHIR_CONFIG.baseUrl),
      pondDevices: Array.isArray(parsed.pondDevices)
        ? parsed.pondDevices
          .filter((row): row is DahirPondDeviceMapping => Boolean(row?.pondId && row?.deviceId))
          .map((row) => ({ pondId: String(row.pondId), deviceId: String(row.deviceId), levelKey: String(row.levelKey || 'waterLevel'), unit: String(row.unit || 'cm') }))
        : [],
      treatmentKeys: Array.isArray(parsed.treatmentKeys) && parsed.treatmentKeys.length
        ? parsed.treatmentKeys.map(String).map((key) => key.trim()).filter(Boolean)
        : DEFAULT_DAHIR_CONFIG.treatmentKeys,
      pollSeconds: Math.max(10, Math.min(300, Number(parsed.pollSeconds || DEFAULT_DAHIR_CONFIG.pollSeconds))),
    };
  } catch {
    return DEFAULT_DAHIR_CONFIG;
  }
}

export function saveDahirConfig(config: DahirConfig): DahirConfig {
  const sanitized: DahirConfig = {
    ...config,
    baseUrl: normalizedBaseUrl(config.baseUrl),
    pondDevices: config.pondDevices.map((row) => ({
      pondId: String(row.pondId).trim(),
      deviceId: String(row.deviceId).trim(),
      levelKey: String(row.levelKey || 'waterLevel').trim(),
      unit: String(row.unit || 'cm').trim(),
    })).filter((row) => row.pondId && row.deviceId),
    treatmentKeys: config.treatmentKeys.map((key) => key.trim()).filter(Boolean),
    pollSeconds: Math.max(10, Math.min(300, Number(config.pollSeconds || 30))),
  };
  if (typeof window !== 'undefined') window.localStorage.setItem(CONFIG_KEY, JSON.stringify(sanitized));
  return sanitized;
}

interface DahirSessionAuth {
  mode: DahirAuthMode;
  credential: string;
}

function readSessionAuth(): DahirSessionAuth | null {
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(SESSION_AUTH_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DahirSessionAuth;
    return parsed?.credential && (parsed.mode === 'jwt' || parsed.mode === 'apiKey') ? parsed : null;
  } catch {
    return null;
  }
}

export function clearDahirSession(): void {
  try { window.sessionStorage.removeItem(SESSION_AUTH_KEY); } catch { /* no-op */ }
}

export function hasDahirSession(): boolean {
  return Boolean(readSessionAuth());
}

export function setDahirApiKeyForSession(apiKey: string): void {
  if (!apiKey.trim()) throw new Error('DAHIR_API_KEY_REQUIRED');
  window.sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify({ mode: 'apiKey', credential: apiKey.trim() } satisfies DahirSessionAuth));
}

export async function loginToDahir(baseUrl: string, username: string, password: string): Promise<void> {
  const root = normalizedBaseUrl(baseUrl);
  if (!root || !username.trim() || !password) throw new Error('DAHIR_LOGIN_FIELDS_REQUIRED');
  const response = await fetch(`${root}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload?.token !== 'string' || !payload.token) throw new Error(payload?.message || payload?.error || 'DAHIR_LOGIN_FAILED');
  window.sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify({ mode: 'jwt', credential: payload.token } satisfies DahirSessionAuth));
}

function authorizationHeaders(): HeadersInit {
  const auth = readSessionAuth();
  if (!auth) throw new Error('DAHIR_AUTH_REQUIRED');
  return auth.mode === 'apiKey'
    ? { Accept: 'application/json', 'X-Authorization': `ApiKey ${auth.credential}` }
    : { Accept: 'application/json', 'X-Authorization': `Bearer ${auth.credential}` };
}

function normalizePoint(key: string, item: any): DahirTelemetryPoint | undefined {
  if (!item || !Number.isFinite(Number(item.ts))) return undefined;
  const ts = Number(item.ts);
  const ageMinutes = Math.max(0, (Date.now() - ts) / 60_000);
  const raw = item.value ?? null;
  return {
    key,
    value: raw,
    numericValue: finiteNumber(raw),
    ts,
    timestamp: new Date(ts).toISOString(),
    ageMinutes: Number(ageMinutes.toFixed(1)),
    isFresh: ageMinutes <= DAHIR_MAX_DATA_AGE_MINUTES,
  };
}

export async function fetchDahirLatestTelemetry(baseUrl: string, deviceId: string, keys: string[]): Promise<Record<string, DahirTelemetryPoint>> {
  const root = normalizedBaseUrl(baseUrl);
  if (!root || !deviceId.trim()) throw new Error('DAHIR_DEVICE_REQUIRED');
  const uniqueKeys = [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
  if (!uniqueKeys.length) throw new Error('DAHIR_KEYS_REQUIRED');
  const url = `${root}/api/plugins/telemetry/DEVICE/${encodeURIComponent(deviceId.trim())}/values/timeseries?keys=${encodeURIComponent(uniqueKeys.join(','))}`;
  const response = await fetch(url, { headers: authorizationHeaders() });
  if (response.status === 401 || response.status === 403) clearDahirSession();
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || `DAHIR_HTTP_${response.status}`);
  const result: Record<string, DahirTelemetryPoint> = {};
  for (const key of uniqueKeys) {
    const point = normalizePoint(key, Array.isArray(payload?.[key]) ? payload[key][0] : undefined);
    if (point) result[key] = point;
  }
  return result;
}

export async function fetchDahirPondLevels(config: DahirConfig): Promise<DahirPondLevelReading[]> {
  return Promise.all(config.pondDevices.map(async (mapping) => {
    try {
      const data = await fetchDahirLatestTelemetry(config.baseUrl, mapping.deviceId, [mapping.levelKey || 'waterLevel']);
      return { ...mapping, key: mapping.levelKey || 'waterLevel', point: data[mapping.levelKey || 'waterLevel'] };
    } catch (error) {
      return { ...mapping, key: mapping.levelKey || 'waterLevel', error: error instanceof Error ? error.message : 'DAHIR_LEVEL_READ_FAILED' };
    }
  }));
}

export async function fetchDahirTreatmentPlant(config: DahirConfig): Promise<Record<string, DahirTelemetryPoint>> {
  if (!config.treatmentDeviceId.trim()) throw new Error('DAHIR_TREATMENT_DEVICE_REQUIRED');
  return fetchDahirLatestTelemetry(config.baseUrl, config.treatmentDeviceId, config.treatmentKeys);
}
