import crypto from 'crypto';
import path from 'path';
import { createRequire } from 'module';
import { defaultDatabasePath } from './storage';

export type ColdStorageEventType = 'MOVE' | 'TEMPERATURE_CHECK' | 'QUALITY_HOLD' | 'RELEASE' | 'CYCLE_COUNT';

export interface ColdStorageEvent {
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

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: unknown[]): any[]; run(...params: unknown[]): { changes?: number } };
  close(): void;
};

const nodeRequire = createRequire(typeof __filename === 'string' ? __filename : path.join(process.cwd(), 'server', 'coldStorageLedger.ts'));
const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: new (filename: string) => SqliteDatabase };

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export class ColdStorageLedgerStore {
  private readonly db: SqliteDatabase;

  constructor(filename = defaultDatabasePath()) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS cold_storage_events (
        id TEXT PRIMARY KEY,
        pallet_id TEXT NOT NULL,
        batch_code TEXT NOT NULL,
        event_type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        actor TEXT NOT NULL,
        notes TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cold_storage_events_pallet ON cold_storage_events(pallet_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_cold_storage_events_type ON cold_storage_events(event_type, timestamp DESC);
    `);
  }

  append(input: Omit<ColdStorageEvent, 'id' | 'timestamp'> & { timestamp?: string }): ColdStorageEvent {
    const event: ColdStorageEvent = {
      ...input,
      id: `cse_${crypto.randomUUID()}`,
      palletId: clean(input.palletId, 160),
      batchCode: clean(input.batchCode, 160),
      actor: clean(input.actor, 200),
      notes: clean(input.notes, 1000),
      reason: clean(input.reason, 500) || undefined,
      timestamp: input.timestamp && Number.isFinite(new Date(input.timestamp).getTime()) ? new Date(input.timestamp).toISOString() : new Date().toISOString(),
    };
    if (!event.palletId || !event.batchCode || !event.actor) throw new Error('COLD_STORAGE_EVENT_REQUIRED_FIELDS');
    this.db.prepare('INSERT INTO cold_storage_events (id, pallet_id, batch_code, event_type, timestamp, actor, notes, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(event.id, event.palletId, event.batchCode, event.eventType, event.timestamp, event.actor, event.notes, JSON.stringify(event));
    return event;
  }

  list(limit = 500, palletId?: string): ColdStorageEvent[] {
    const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));
    const rows = palletId
      ? this.db.prepare('SELECT payload_json FROM cold_storage_events WHERE pallet_id = ? ORDER BY timestamp DESC LIMIT ?').all(clean(palletId, 160), safeLimit)
      : this.db.prepare('SELECT payload_json FROM cold_storage_events ORDER BY timestamp DESC LIMIT ?').all(safeLimit);
    return rows.flatMap((row) => {
      try { return [JSON.parse(String(row.payload_json)) as ColdStorageEvent]; } catch { return []; }
    });
  }

  close(): void { this.db.close(); }
}
