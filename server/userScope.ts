import path from 'path';
import { createRequire } from 'module';

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): any;
    run(...params: unknown[]): { changes?: number };
  };
  close(): void;
}

const nodeRequire = createRequire(typeof __filename === 'string' ? __filename : path.join(process.cwd(), 'server', 'userScope.ts'));
const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: new (filename: string) => SqliteDatabase };

export interface UserDataScope {
  hallScope: string[];
  pondScope: string[];
}

export function normalizeScopeIds(value: unknown, maxItems = 500): string[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .slice(0, maxItems)
    .map((item) => String(item || '').trim())
    .filter((item) => /^[A-Za-z0-9_.:-]{1,128}$/.test(item));
  return [...new Set(normalized)];
}

function parseIds(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try { return normalizeScopeIds(JSON.parse(value)); } catch { return []; }
}

export class UserScopeStore {
  private readonly db: SqliteDatabase;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS user_data_scope (
        user_id TEXT PRIMARY KEY,
        hall_scope_json TEXT NOT NULL DEFAULT '[]',
        pond_scope_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );
    `);
  }

  get(userId: string): UserDataScope {
    const row = this.db.prepare('SELECT hall_scope_json, pond_scope_json FROM user_data_scope WHERE user_id = ?').get(userId);
    if (!row) return { hallScope: [], pondScope: [] };
    return { hallScope: parseIds(row.hall_scope_json), pondScope: parseIds(row.pond_scope_json) };
  }

  set(userId: string, scope: UserDataScope): UserDataScope {
    const normalized = {
      hallScope: normalizeScopeIds(scope.hallScope),
      pondScope: normalizeScopeIds(scope.pondScope),
    };
    this.db.prepare(`
      INSERT INTO user_data_scope (user_id, hall_scope_json, pond_scope_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        hall_scope_json = excluded.hall_scope_json,
        pond_scope_json = excluded.pond_scope_json,
        updated_at = excluded.updated_at
    `).run(userId, JSON.stringify(normalized.hallScope), JSON.stringify(normalized.pondScope), new Date().toISOString());
    return normalized;
  }

  delete(userId: string): void {
    this.db.prepare('DELETE FROM user_data_scope WHERE user_id = ?').run(userId);
  }

  close(): void { this.db.close(); }
}
