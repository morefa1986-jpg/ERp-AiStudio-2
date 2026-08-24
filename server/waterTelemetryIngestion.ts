import crypto from 'crypto';
import path from 'path';
import { createRequire } from 'module';
import { DahirGatewayPoint } from './dahirGateway';
import { defaultDatabasePath } from './storage';
import { assessWaterSafetyForFeeding, SENSOR_MAX_AGE_MINUTES } from '../src/utils/sensorValidation';

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

export interface WaterTelemetryMutationResult {
  ok: boolean;
  error?: string;
  state?: Record<string, unknown>;
  log?: Record<string, unknown>;
  pond?: Record<string, unknown>;
}

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): any;
    all(...params: unknown[]): any[];
    run(...params: unknown[]): { changes?: number };
  };
  close(): void;
};

const nodeRequire = createRequire(typeof __filename === 'string' ? __filename : path.join(process.cwd(), 'server', 'waterTelemetryIngestion.ts'));
const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: new (filename: string) => SqliteDatabase };
const KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;
const REQUIRED_KEYS: (keyof WaterTelemetryKeyMap)[] = ['dissolvedOxygen', 'temperature', 'ph', 'ammonia', 'nitrite'];
const MAX_POINT_SPREAD_MS = 2 * 60_000;

function rows(state: Record<string, unknown>, key: string): any[] {
  return Array.isArray(state[key]) ? state[key] as any[] : [];
}

function validKey(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 80 && KEY_PATTERN.test(value.trim());
}

export function validateWaterTelemetryMappingInput(raw: any): { ok: true; pondId: string; deviceId: string; keys: WaterTelemetryKeyMap } | { ok: false; error: string } {
  const pondId = typeof raw?.pondId === 'string' ? raw.pondId.trim() : '';
  const deviceId = typeof raw?.deviceId === 'string' ? raw.deviceId.trim() : '';
  if (!pondId || pondId.length > 160) return { ok: false, error: 'WATER_MAPPING_POND_INVALID' };
  if (!deviceId || deviceId.length > 160 || !KEY_PATTERN.test(deviceId)) return { ok: false, error: 'WATER_MAPPING_DEVICE_INVALID' };
  const source = raw?.keys || {};
  const keys = {} as WaterTelemetryKeyMap;
  for (const field of REQUIRED_KEYS) {
    if (!validKey(source[field])) return { ok: false, error: `WATER_MAPPING_KEY_INVALID:${field}` };
    keys[field] = source[field].trim();
  }
  if (new Set(Object.values(keys)).size !== REQUIRED_KEYS.length) return { ok: false, error: 'WATER_MAPPING_KEYS_DUPLICATE' };
  return { ok: true, pondId, deviceId, keys };
}

export class WaterTelemetryMappingStore {
  private readonly db: SqliteDatabase;

  constructor(filename = defaultDatabasePath()) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS water_telemetry_mappings (
        id TEXT PRIMARY KEY,
        pond_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        keys_json TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_water_mapping_pond ON water_telemetry_mappings(pond_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_water_mapping_device ON water_telemetry_mappings(device_id, is_active);
    `);
  }

  list(): WaterTelemetryMapping[] {
    return this.db.prepare('SELECT id, pond_id, device_id, keys_json, is_active, created_at, updated_at FROM water_telemetry_mappings ORDER BY updated_at DESC').all().map((row) => ({
      id: String(row.id), pondId: String(row.pond_id), deviceId: String(row.device_id),
      keys: JSON.parse(String(row.keys_json)) as WaterTelemetryKeyMap,
      isActive: Number(row.is_active) === 1, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    }));
  }

  get(id: string): WaterTelemetryMapping | null {
    return this.list().find((row) => row.id === id) || null;
  }

  create(input: { pondId: string; deviceId: string; keys: WaterTelemetryKeyMap }): WaterTelemetryMapping {
    if (this.list().some((row) => row.isActive && row.pondId === input.pondId)) throw new Error('WATER_MAPPING_POND_ALREADY_MAPPED');
    const now = new Date().toISOString();
    const mapping: WaterTelemetryMapping = { id: `wtm_${crypto.randomUUID()}`, ...input, isActive: true, createdAt: now, updatedAt: now };
    this.db.prepare('INSERT INTO water_telemetry_mappings (id, pond_id, device_id, keys_json, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)')
      .run(mapping.id, mapping.pondId, mapping.deviceId, JSON.stringify(mapping.keys), now, now);
    return mapping;
  }

  setActive(id: string, isActive: boolean): WaterTelemetryMapping | null {
    const current = this.get(id);
    if (!current) return null;
    if (isActive && this.list().some((row) => row.id !== id && row.isActive && row.pondId === current.pondId)) throw new Error('WATER_MAPPING_POND_ALREADY_MAPPED');
    const updatedAt = new Date().toISOString();
    this.db.prepare('UPDATE water_telemetry_mappings SET is_active = ?, updated_at = ? WHERE id = ?').run(isActive ? 1 : 0, updatedAt, id);
    return { ...current, isActive, updatedAt };
  }

  close(): void { this.db.close(); }
}

function pointFor(points: Record<string, DahirGatewayPoint>, key: string): DahirGatewayPoint | null {
  const point = points[key];
  return point && point.numericValue !== null && Number.isFinite(point.numericValue) ? point : null;
}

export function buildAuthoritativeWaterMutation(
  state: Record<string, unknown>,
  mapping: WaterTelemetryMapping,
  points: Record<string, DahirGatewayPoint>,
  operator: string,
  now = Date.now(),
): WaterTelemetryMutationResult {
  if (!mapping.isActive) return { ok: false, error: 'WATER_MAPPING_INACTIVE' };
  const ponds = rows(state, 'ponds');
  const pond = ponds.find((row) => row?.id === mapping.pondId);
  if (!pond || pond?.isActive === false) return { ok: false, error: 'WATER_MAPPING_POND_NOT_ACTIVE' };
  const halls = rows(state, 'halls');
  const hall = halls.find((row) => row?.id === pond.hallId);

  const doPoint = pointFor(points, mapping.keys.dissolvedOxygen);
  const tempPoint = pointFor(points, mapping.keys.temperature);
  const phPoint = pointFor(points, mapping.keys.ph);
  const ammoniaPoint = pointFor(points, mapping.keys.ammonia);
  const nitritePoint = pointFor(points, mapping.keys.nitrite);
  const required = [doPoint, tempPoint, phPoint, ammoniaPoint, nitritePoint];
  if (required.some((point) => !point)) return { ok: false, error: 'WATER_TELEMETRY_REQUIRED_POINT_MISSING' };

  const typed = required as DahirGatewayPoint[];
  const timestamps = typed.map((point) => point.ts);
  if (timestamps.some((ts) => !Number.isFinite(ts))) return { ok: false, error: 'WATER_TELEMETRY_TIMESTAMP_INVALID' };
  const oldestTs = Math.min(...timestamps);
  const newestTs = Math.max(...timestamps);
  if (newestTs - oldestTs > MAX_POINT_SPREAD_MS) return { ok: false, error: 'WATER_TELEMETRY_POINTS_NOT_SYNCHRONIZED' };
  const ageMinutes = (now - oldestTs) / 60_000;
  if (ageMinutes < -15 || ageMinutes > SENSOR_MAX_AGE_MINUTES || typed.some((point) => !point.isFresh)) return { ok: false, error: 'WATER_TELEMETRY_NOT_FRESH' };
  const timestamp = new Date(oldestTs).toISOString();

  const values = {
    dissolvedOxygen: doPoint!.numericValue as number,
    temperature: tempPoint!.numericValue as number,
    ph: phPoint!.numericValue as number,
    ammonia: ammoniaPoint!.numericValue as number,
    nitrite: nitritePoint!.numericValue as number,
  };
  const safety = assessWaterSafetyForFeeding({
    dissolvedOxygen: values.dissolvedOxygen,
    waterTemperature: values.temperature,
    ph: values.ph,
    ammonia: values.ammonia,
    nitrite: values.nitrite,
    timestamp,
    sensorStatus: 'VALID',
  });
  const statuses = [safety.doStatus, safety.tempStatus, safety.phStatus, safety.ammoniaStatus, safety.nitriteStatus].filter(Boolean);
  if (statuses.some((status) => !status!.isValid || ['STALE', 'SENSOR_FAULT', 'DISCONNECTED'].includes(status!.status))) {
    return { ok: false, error: 'WATER_TELEMETRY_NOT_AUTHORITATIVE' };
  }

  const hasWarning = statuses.some((status) => status!.status === 'WARNING');
  const severity = safety.isCriticalAlert ? 'CRITICAL' : hasWarning ? 'WARNING' : 'INFO';
  const log = {
    id: `water_sensor_${crypto.randomUUID()}`,
    pondId: pond.id,
    pondName: pond.name,
    hallName: hall?.name || pond.hallId,
    timestamp,
    temperature: values.temperature,
    dissolvedOxygen: values.dissolvedOxygen,
    ph: values.ph,
    ammonia: values.ammonia,
    nitrite: values.nitrite,
    sensorStatus: 'VALID',
    severity,
    alertMessage: safety.feedingProhibitionReason,
    operator: operator || 'Server telemetry ingestion',
    telemetryMappingId: mapping.id,
    telemetryDeviceId: mapping.deviceId,
  };

  const updatedPond = {
    ...pond,
    dissolvedOxygen: values.dissolvedOxygen,
    waterTemperature: values.temperature,
    ph: values.ph,
    ammonia: values.ammonia,
    nitrite: values.nitrite,
    lastTelemetryTimestamp: timestamp,
    sensorQuality: 'VALID',
    feedingStatus: safety.isSafeForFeeding ? pond.feedingStatus : 'STOPPED',
    stopFeedingReason: safety.isSafeForFeeding ? pond.stopFeedingReason : (values.dissolvedOxygen < 4 ? 'Low Oxygen' : values.temperature < 4 ? 'Low Temperature' : 'Manual Decision'),
    stopFeedingDetails: safety.isSafeForFeeding ? pond.stopFeedingDetails : safety.feedingProhibitionReason,
    stopFeedingTimestamp: safety.isSafeForFeeding ? pond.stopFeedingTimestamp : timestamp,
  };

  return {
    ok: true,
    log,
    pond: updatedPond,
    state: {
      ...state,
      waterLogs: [log, ...rows(state, 'waterLogs')],
      ponds: ponds.map((row) => row?.id === pond.id ? updatedPond : row),
    },
  };
}
