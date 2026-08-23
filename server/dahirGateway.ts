export interface DahirGatewayPoint {
  key: string;
  value: number | string | boolean | null;
  numericValue: number | null;
  ts: number;
  timestamp: string;
  ageMinutes: number;
  isFresh: boolean;
}

export const DAHIR_GATEWAY_MAX_DATA_AGE_MINUTES = 15;

function baseUrlFromEnv(env: NodeJS.ProcessEnv): string {
  const raw = String(env.DAHIR_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!raw) throw new Error('DAHIR_NOT_CONFIGURED');
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error('DAHIR_BASE_URL_INVALID'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('DAHIR_BASE_URL_INVALID');
  return parsed.toString().replace(/\/+$/, '');
}

function authHeaderFromEnv(env: NodeJS.ProcessEnv): string {
  const apiKey = String(env.DAHIR_API_KEY || '').trim();
  const bearer = String(env.DAHIR_BEARER_TOKEN || '').trim();
  if (apiKey) return `ApiKey ${apiKey}`;
  if (bearer) return `Bearer ${bearer}`;
  throw new Error('DAHIR_SERVER_CREDENTIAL_REQUIRED');
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizePoint(key: string, item: any, now = Date.now()): DahirGatewayPoint | undefined {
  if (!item || !Number.isFinite(Number(item.ts))) return undefined;
  const ts = Number(item.ts);
  const ageMinutes = Math.max(0, (now - ts) / 60_000);
  const value = item.value ?? null;
  return {
    key,
    value,
    numericValue: finiteNumber(value),
    ts,
    timestamp: new Date(ts).toISOString(),
    ageMinutes: Number(ageMinutes.toFixed(1)),
    isFresh: ageMinutes <= DAHIR_GATEWAY_MAX_DATA_AGE_MINUTES,
  };
}

export function dahirGatewayStatus(env: NodeJS.ProcessEnv = process.env): { configured: boolean; authMode: 'apiKey' | 'bearer' | 'none'; host?: string; maxAgeMinutes: number } {
  const raw = String(env.DAHIR_BASE_URL || '').trim();
  let host: string | undefined;
  try { host = raw ? new URL(raw).host : undefined; } catch { host = undefined; }
  return {
    configured: Boolean(raw && (String(env.DAHIR_API_KEY || '').trim() || String(env.DAHIR_BEARER_TOKEN || '').trim())),
    authMode: String(env.DAHIR_API_KEY || '').trim() ? 'apiKey' : String(env.DAHIR_BEARER_TOKEN || '').trim() ? 'bearer' : 'none',
    host,
    maxAgeMinutes: DAHIR_GATEWAY_MAX_DATA_AGE_MINUTES,
  };
}

export async function fetchDahirTelemetryServerSide(
  deviceId: string,
  keys: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<Record<string, DahirGatewayPoint>> {
  const device = String(deviceId || '').trim();
  if (!device || device.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(device)) throw new Error('DAHIR_DEVICE_INVALID');
  const uniqueKeys = [...new Set(keys.map((key) => String(key || '').trim()).filter(Boolean))];
  if (!uniqueKeys.length || uniqueKeys.length > 30 || uniqueKeys.some((key) => key.length > 80 || !/^[A-Za-z0-9._:-]+$/.test(key))) throw new Error('DAHIR_KEYS_INVALID');

  const root = baseUrlFromEnv(env);
  const auth = authHeaderFromEnv(env);
  const url = `${root}/api/plugins/telemetry/DEVICE/${encodeURIComponent(device)}/values/timeseries?keys=${encodeURIComponent(uniqueKeys.join(','))}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  timer.unref?.();
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'X-Authorization': auth },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error('DAHIR_AUTH_FAILED');
      throw new Error(`DAHIR_HTTP_${response.status}`);
    }
    const result: Record<string, DahirGatewayPoint> = {};
    const now = Date.now();
    for (const key of uniqueKeys) {
      const point = normalizePoint(key, Array.isArray(payload?.[key]) ? payload[key][0] : undefined, now);
      if (point) result[key] = point;
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('DAHIR_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
