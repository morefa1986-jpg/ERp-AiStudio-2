import crypto from 'crypto';
import path from 'path';
import { createRequire } from 'module';
import { defaultDatabasePath } from './storage';
import { assessWaterSafetyForFeeding, SENSOR_MAX_AGE_MINUTES } from '../src/utils/sensorValidation';

export type IncidentSeverity = 'WARNING' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface IncidentCandidate {
  fingerprint: string;
  sourceType: 'WATER_QUALITY' | 'FEEDING' | 'INVENTORY';
  entityId: string;
  pondId?: string;
  hallId?: string;
  severity: IncidentSeverity;
  title: string;
  details: string;
}

export interface OperationalIncident extends IncidentCandidate {
  id: string;
  status: IncidentStatus;
  escalationLevel: number;
  firstSeenAt: string;
  lastSeenAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  externalDispatchState: 'NOT_CONFIGURED';
}

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { get(...params: unknown[]): any; all(...params: unknown[]): any[]; run(...params: unknown[]): { changes?: number } };
  close(): void;
};

const nodeRequire = createRequire(typeof __filename === 'string' ? __filename : path.join(process.cwd(), 'server', 'incidentEngine.ts'));
const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: new (filename: string) => SqliteDatabase };

function rows(state: Record<string, unknown>, key: string): any[] { return Array.isArray(state[key]) ? state[key] as any[] : []; }

function latestWaterByPond(state: Record<string, unknown>): Map<string, any> {
  const result = new Map<string, any>();
  for (const log of rows(state, 'waterLogs')) {
    if (!log?.pondId) continue;
    const current = result.get(log.pondId);
    if (!current || new Date(String(log.timestamp)).getTime() > new Date(String(current.timestamp)).getTime()) result.set(log.pondId, log);
  }
  return result;
}

export function deriveOperationalIncidents(state: Record<string, unknown>, now = Date.now()): IncidentCandidate[] {
  const candidates: IncidentCandidate[] = [];
  const latest = latestWaterByPond(state);
  for (const pond of rows(state, 'ponds').filter((row) => row?.isActive !== false)) {
    const log = latest.get(pond.id);
    const hallId = String(pond.hallId || '');
    const logTs = log?.timestamp ? new Date(String(log.timestamp)).getTime() : Number.NaN;
    const ageMinutes = Number.isFinite(logTs) ? (now - logTs) / 60_000 : Number.POSITIVE_INFINITY;
    const stale = !log || log.sensorStatus !== 'VALID' || !Number.isFinite(logTs) || ageMinutes > SENSOR_MAX_AGE_MINUTES || ageMinutes < -15;
    if (stale) {
      candidates.push({
        fingerprint: `water:${pond.id}:telemetry-untrusted`, sourceType: 'WATER_QUALITY', entityId: String(log?.id || pond.id), pondId: pond.id, hallId,
        severity: pond.feedingStatus === 'ACTIVE' ? 'CRITICAL' : 'HIGH',
        title: `تله‌متری معتبر برای ${pond.name || pond.number || pond.id} موجود نیست`,
        details: log ? `آخرین داده ${Number.isFinite(ageMinutes) ? Math.round(ageMinutes) : 'نامشخص'} دقیقه قبل و وضعیت ${String(log.sensorStatus || 'UNKNOWN')} است.` : 'برای این استخر رکورد سنسور معتبر موجود نیست.',
      });
    } else {
      const safety = assessWaterSafetyForFeeding({
        dissolvedOxygen: log.dissolvedOxygen, waterTemperature: log.temperature, ph: log.ph, ammonia: log.ammonia, nitrite: log.nitrite,
        timestamp: log.timestamp, sensorStatus: log.sensorStatus,
      });
      if (!safety.isSafeForFeeding) {
        candidates.push({
          fingerprint: `water:${pond.id}:unsafe`, sourceType: 'WATER_QUALITY', entityId: String(log.id), pondId: pond.id, hallId,
          severity: 'CRITICAL', title: `پارامتر آب بحرانی در ${pond.name || pond.number || pond.id}`,
          details: safety.feedingProhibitionReason || 'حداقل یک پارامتر آب برای تغذیه ایمن نیست.',
        });
      }
    }

    if (pond.feedingStatus === 'STOPPED' && ['Disease', 'Low Oxygen'].includes(String(pond.stopFeedingReason || ''))) {
      candidates.push({
        fingerprint: `feeding:${pond.id}:${pond.stopFeedingReason}`, sourceType: 'FEEDING', entityId: pond.id, pondId: pond.id, hallId,
        severity: pond.stopFeedingReason === 'Low Oxygen' ? 'CRITICAL' : 'HIGH',
        title: `تغذیه ${pond.name || pond.number || pond.id} به علت ${pond.stopFeedingReason} متوقف است`,
        details: String(pond.stopFeedingDetails || 'نیازمند بررسی عملیاتی و ثبت اقدام اصلاحی.'),
      });
    }
  }

  for (const item of rows(state, 'inventory')) {
    const status = String(item?.status || '');
    if (status === 'Expired' || status === 'Critical Low') {
      candidates.push({
        fingerprint: `inventory:${item.id}:${status}`, sourceType: 'INVENTORY', entityId: String(item.id),
        severity: status === 'Expired' ? 'HIGH' : 'WARNING',
        title: status === 'Expired' ? `آیتم منقضی: ${item.name}` : `موجودی بحرانی: ${item.name}`,
        details: `SKU ${String(item.sku || '—')} · موجودی ${String(item.quantity ?? '—')} ${String(item.unit || '')}`,
      });
    }
  }
  return candidates;
}

function mapIncident(row: any): OperationalIncident {
  return {
    id: String(row.id), fingerprint: String(row.fingerprint), sourceType: row.source_type, entityId: String(row.entity_id),
    pondId: row.pond_id ? String(row.pond_id) : undefined, hallId: row.hall_id ? String(row.hall_id) : undefined,
    severity: row.severity, title: String(row.title), details: String(row.details), status: row.status,
    escalationLevel: Number(row.escalation_level), firstSeenAt: String(row.first_seen_at), lastSeenAt: String(row.last_seen_at),
    acknowledgedBy: row.acknowledged_by ? String(row.acknowledged_by) : undefined, acknowledgedAt: row.acknowledged_at ? String(row.acknowledged_at) : undefined,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : undefined, resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
    resolutionNote: row.resolution_note ? String(row.resolution_note) : undefined, externalDispatchState: 'NOT_CONFIGURED',
  };
}

export class IncidentStore {
  private readonly db: SqliteDatabase;
  constructor(filename = defaultDatabasePath()) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS operational_incidents (
        id TEXT PRIMARY KEY, fingerprint TEXT UNIQUE NOT NULL, source_type TEXT NOT NULL, entity_id TEXT NOT NULL,
        pond_id TEXT, hall_id TEXT, severity TEXT NOT NULL, title TEXT NOT NULL, details TEXT NOT NULL,
        status TEXT NOT NULL, escalation_level INTEGER NOT NULL DEFAULT 0, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
        acknowledged_by TEXT, acknowledged_at TEXT, resolved_by TEXT, resolved_at TEXT, resolution_note TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_incidents_status ON operational_incidents(status, severity, last_seen_at);
      CREATE INDEX IF NOT EXISTS idx_incidents_scope ON operational_incidents(hall_id, pond_id, status);
    `);
  }

  syncCandidates(candidates: IncidentCandidate[], now = new Date().toISOString()): OperationalIncident[] {
    const fingerprints = new Set(candidates.map((row) => row.fingerprint));
    for (const candidate of candidates) {
      const existing = this.db.prepare('SELECT * FROM operational_incidents WHERE fingerprint = ?').get(candidate.fingerprint);
      if (!existing) {
        this.db.prepare('INSERT INTO operational_incidents (id, fingerprint, source_type, entity_id, pond_id, hall_id, severity, title, details, status, escalation_level, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)')
          .run(`incident_${crypto.randomUUID()}`, candidate.fingerprint, candidate.sourceType, candidate.entityId, candidate.pondId || null, candidate.hallId || null, candidate.severity, candidate.title, candidate.details, 'OPEN', now, now);
      } else {
        const reopen = existing.status === 'RESOLVED';
        this.db.prepare('UPDATE operational_incidents SET source_type=?, entity_id=?, pond_id=?, hall_id=?, severity=?, title=?, details=?, last_seen_at=?, status=?, resolved_by=?, resolved_at=?, resolution_note=? WHERE fingerprint=?')
          .run(candidate.sourceType, candidate.entityId, candidate.pondId || null, candidate.hallId || null, candidate.severity, candidate.title, candidate.details, now, reopen ? 'OPEN' : existing.status, reopen ? null : existing.resolved_by, reopen ? null : existing.resolved_at, reopen ? null : existing.resolution_note, candidate.fingerprint);
      }
    }
    for (const row of this.db.prepare("SELECT * FROM operational_incidents WHERE status != 'RESOLVED'").all()) {
      if (!fingerprints.has(String(row.fingerprint))) {
        this.db.prepare("UPDATE operational_incidents SET status='RESOLVED', resolved_by='SYSTEM', resolved_at=?, resolution_note='Condition no longer detected by authoritative state sync' WHERE id=?").run(now, row.id);
      }
    }
    return this.list();
  }

  list(): OperationalIncident[] { return this.db.prepare('SELECT * FROM operational_incidents ORDER BY CASE severity WHEN \'CRITICAL\' THEN 3 WHEN \'HIGH\' THEN 2 ELSE 1 END DESC, last_seen_at DESC').all().map(mapIncident); }
  get(id: string): OperationalIncident | null { const row = this.db.prepare('SELECT * FROM operational_incidents WHERE id=?').get(id); return row ? mapIncident(row) : null; }

  acknowledge(id: string, user: string): OperationalIncident {
    const current = this.get(id); if (!current) throw new Error('INCIDENT_NOT_FOUND'); if (current.status === 'RESOLVED') throw new Error('INCIDENT_ALREADY_RESOLVED');
    const now = new Date().toISOString(); this.db.prepare("UPDATE operational_incidents SET status='ACKNOWLEDGED', acknowledged_by=?, acknowledged_at=? WHERE id=?").run(user, now, id); return this.get(id)!;
  }
  escalate(id: string, user: string): OperationalIncident {
    const current = this.get(id); if (!current) throw new Error('INCIDENT_NOT_FOUND'); if (current.status === 'RESOLVED') throw new Error('INCIDENT_ALREADY_RESOLVED');
    const next = Math.min(3, current.escalationLevel + 1); const now = new Date().toISOString();
    this.db.prepare("UPDATE operational_incidents SET escalation_level=?, status='ACKNOWLEDGED', acknowledged_by=COALESCE(acknowledged_by, ?), acknowledged_at=COALESCE(acknowledged_at, ?) WHERE id=?").run(next, user, now, id); return this.get(id)!;
  }
  resolve(id: string, user: string, note: string): OperationalIncident {
    const current = this.get(id); if (!current) throw new Error('INCIDENT_NOT_FOUND');
    const cleanNote = String(note || '').trim().slice(0, 1000); if (!cleanNote) throw new Error('INCIDENT_RESOLUTION_NOTE_REQUIRED');
    const now = new Date().toISOString(); this.db.prepare("UPDATE operational_incidents SET status='RESOLVED', resolved_by=?, resolved_at=?, resolution_note=? WHERE id=?").run(user, now, cleanNote, id); return this.get(id)!;
  }
  close(): void { this.db.close(); }
}
