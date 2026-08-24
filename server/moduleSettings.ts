import path from 'path';
import { createRequire } from 'module';
import { defaultDatabasePath } from './storage';
import { normalizeModuleVisibility, SharedModuleVisibilityMap } from '../src/utils/moduleVisibilityPolicy';

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): any;
    run(...params: unknown[]): { changes?: number };
  };
  close(): void;
};

const nodeRequire = createRequire(typeof __filename === 'string' ? __filename : path.join(process.cwd(), 'server', 'moduleSettings.ts'));
const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: new (filename: string) => SqliteDatabase };
const VISIBILITY_KEY = 'module_visibility_v1';

export class ModuleSettingsStore {
  private readonly db: SqliteDatabase;

  constructor(filename = defaultDatabasePath()) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  getModuleVisibility(): SharedModuleVisibilityMap {
    const row = this.db.prepare('SELECT value_json FROM system_settings WHERE key = ?').get(VISIBILITY_KEY);
    if (!row) return normalizeModuleVisibility(undefined);
    try { return normalizeModuleVisibility(JSON.parse(String(row.value_json))); }
    catch { return normalizeModuleVisibility(undefined); }
  }

  setModuleVisibility(visibility: SharedModuleVisibilityMap): SharedModuleVisibilityMap {
    const normalized = normalizeModuleVisibility(visibility);
    this.db.prepare(`
      INSERT INTO system_settings (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `).run(VISIBILITY_KEY, JSON.stringify(normalized), new Date().toISOString());
    return normalized;
  }

  close(): void { this.db.close(); }
}
