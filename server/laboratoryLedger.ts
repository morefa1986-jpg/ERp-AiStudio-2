import crypto from 'crypto';
import path from 'path';
import { createRequire } from 'module';
import { defaultDatabasePath } from './storage';

export type LaboratoryEventType = 'SAMPLE_CREATED' | 'RESULTS_RECORDED' | 'APPROVED' | 'REJECTED';

export interface LaboratoryEvent {
  id: string;
  sampleId: string;
  sampleCode: string;
  eventType: LaboratoryEventType;
  timestamp: string;
  actor: string;
  notes: string;
  criticalCount?: number;
}

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: unknown[]): any[]; run(...params: unknown[]): { changes?: number } };
  close(): void;
};

const nodeRequire = createRequire(typeof __filename === 'string' ? __filename : path.join(process.cwd(), 'server', 'laboratoryLedger.ts'));
const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: new (filename: string) => SqliteDatabase };

function clean(value: unknown, max: number): string { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

export class LaboratoryLedgerStore {
  private readonly db: SqliteDatabase;
  constructor(filename = defaultDatabasePath()) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS laboratory_events (
        id TEXT PRIMARY KEY,
        sample_id TEXT NOT NULL,
        sample_code TEXT NOT NULL,
        event_type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        actor TEXT NOT NULL,
        notes TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_lab_events_sample ON laboratory_events(sample_id, timestamp DESC);
    `);
  }
  append(input: Omit<LaboratoryEvent, 'id' | 'timestamp'> & { timestamp?: string }): LaboratoryEvent {
    const event: LaboratoryEvent = {
      ...input,
      id: `labevt_${crypto.randomUUID()}`,
      sampleId: clean(input.sampleId, 160), sampleCode: clean(input.sampleCode, 120), actor: clean(input.actor, 200), notes: clean(input.notes, 1500),
      timestamp: input.timestamp && Number.isFinite(new Date(input.timestamp).getTime()) ? new Date(input.timestamp).toISOString() : new Date().toISOString(),
    };
    if (!event.sampleId || !event.sampleCode || !event.actor) throw new Error('LAB_EVENT_REQUIRED_FIELDS');
    this.db.prepare('INSERT INTO laboratory_events (id, sample_id, sample_code, event_type, timestamp, actor, notes, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(event.id, event.sampleId, event.sampleCode, event.eventType, event.timestamp, event.actor, event.notes, JSON.stringify(event));
    return event;
  }
  list(limit = 500, sampleId?: string): LaboratoryEvent[] {
    const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));
    const rows = sampleId
      ? this.db.prepare('SELECT payload_json FROM laboratory_events WHERE sample_id = ? ORDER BY timestamp DESC LIMIT ?').all(clean(sampleId, 160), safeLimit)
      : this.db.prepare('SELECT payload_json FROM laboratory_events ORDER BY timestamp DESC LIMIT ?').all(safeLimit);
    return rows.flatMap((row) => { try { return [JSON.parse(String(row.payload_json)) as LaboratoryEvent]; } catch { return []; } });
  }
  close(): void { this.db.close(); }
}
