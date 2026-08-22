import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import crypto from 'crypto';

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): any;
    all(...params: unknown[]): any[];
    run(...params: unknown[]): { changes?: number; lastInsertRowid?: number | bigint };
  };
  close(): void;
};

const nodeRequire = createRequire(typeof __filename === 'string' ? __filename : path.join(process.cwd(), 'server', 'storage.ts'));
const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: new (filename: string) => SqliteDatabase };

export interface StoredStateEnvelope {
  version: number;
  schemaVersion: number;
  updatedAt: string;
  data: Record<string, unknown>;
}

export interface StoredUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  passwordHash: string;
  isActive: boolean;
  preferredLanguage: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface StoredAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  action: string;
  entity: string;
  entityId: string;
  beforeState?: string;
  afterState?: string;
  referenceId?: string;
  transactionId?: string;
  ipAddress?: string;
  deviceId?: string;
}

export interface StoredSocialConnection {
  platformId: string;
  connected: boolean;
  assistedReady?: boolean;
  accountLabel?: string;
  connectedAt?: string;
  lastOpenedAt?: string;
}

export interface StoredSocialDraft {
  id: string;
  title: string;
  caption: string;
  hashtags: string[];
  platformIds: string[];
  mediaAssetIds: string[];
  scheduledAt?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  publishedAt?: string;
  notes?: string;
}

export class StateConflictError extends Error {
  readonly current: StoredStateEnvelope;

  constructor(current: StoredStateEnvelope) {
    super('STATE_VERSION_CONFLICT');
    this.name = 'StateConflictError';
    this.current = current;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseState(row: any): StoredStateEnvelope {
  return {
    version: Number(row.version),
    schemaVersion: Number(row.schema_version),
    updatedAt: String(row.updated_at),
    data: JSON.parse(String(row.data_json)) as Record<string, unknown>,
  };
}

export class SqliteERPStore {
  private readonly db: SqliteDatabase;

  constructor(filename: string) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS erp_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        schema_version INTEGER NOT NULL,
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        data_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        preferred_language TEXT NOT NULL DEFAULT 'fa',
        last_login_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_role TEXT NOT NULL,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        before_state TEXT,
        after_state TEXT,
        reference_id TEXT,
        transaction_id TEXT,
        ip_address TEXT,
        device_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
      CREATE TABLE IF NOT EXISTS state_snapshots (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        reason TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        version INTEGER NOT NULL,
        data_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_state_snapshots_created_at ON state_snapshots(created_at DESC);
      CREATE TABLE IF NOT EXISTS login_throttle (
        throttle_key TEXT PRIMARY KEY,
        window_started_at INTEGER NOT NULL,
        failures INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS social_connections (
        platform_id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS social_drafts (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_social_drafts_updated_at ON social_drafts(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_social_drafts_status ON social_drafts(status);
    `);
    try { this.db.exec('ALTER TABLE audit_log ADD COLUMN transaction_id TEXT'); } catch { /* already migrated */ }
  }

  getState(): StoredStateEnvelope | null {
    const row = this.db.prepare('SELECT schema_version, version, updated_at, data_json FROM erp_state WHERE id = 1').get();
    return row ? parseState(row) : null;
  }

  saveState(data: Record<string, unknown>, expectedVersion: number | null): StoredStateEnvelope {
    return this.persistState(data, expectedVersion);
  }

  saveStateAndAudit(data: Record<string, unknown>, expectedVersion: number | null, audit: StoredAuditLog): StoredStateEnvelope {
    return this.persistState(data, expectedVersion, audit);
  }

  private persistState(data: Record<string, unknown>, expectedVersion: number | null, audit?: StoredAuditLog): StoredStateEnvelope {
    const serialized = JSON.stringify(data);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.getState();
      if (expectedVersion !== null && current && current.version !== expectedVersion) {
        throw new StateConflictError(current);
      }
      const next: StoredStateEnvelope = {
        version: (current?.version || 0) + 1,
        schemaVersion: 2,
        updatedAt: nowIso(),
        data,
      };
      this.db.prepare(`
        INSERT INTO erp_state (id, schema_version, version, updated_at, data_json)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          schema_version = excluded.schema_version,
          version = excluded.version,
          updated_at = excluded.updated_at,
        data_json = excluded.data_json
      `).run(next.schemaVersion, next.version, next.updatedAt, serialized);
      if (audit) this.insertAuditLog(audit);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.getState() as StoredStateEnvelope;
  }

  createStateSnapshot(reason: string, state?: StoredStateEnvelope): string | null {
    const source = state || this.getState();
    if (!source) return null;
    const id = `snapshot_${crypto.randomUUID()}`;
    this.db.prepare(`
      INSERT INTO state_snapshots (id, created_at, reason, schema_version, version, data_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, nowIso(), reason, source.schemaVersion, source.version, JSON.stringify(source.data));
    return id;
  }

  getStateSnapshot(id: string): StoredStateEnvelope | null {
    const row = this.db.prepare('SELECT schema_version, version, created_at AS updated_at, data_json FROM state_snapshots WHERE id = ?').get(id);
    return row ? parseState(row) : null;
  }

  hasUsers(): boolean {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM users').get();
    return Number(row?.count || 0) > 0;
  }

  getUserByUsername(username: string): StoredUser | null {
    const row = this.db.prepare(`
      SELECT id, username, full_name, email, role, password_hash, is_active, preferred_language, last_login_at, created_at
      FROM users WHERE username = ? COLLATE NOCASE
    `).get(username);
    return row ? this.mapUser(row) : null;
  }

  getUserById(id: string): StoredUser | null {
    const row = this.db.prepare(`
      SELECT id, username, full_name, email, role, password_hash, is_active, preferred_language, last_login_at, created_at
      FROM users WHERE id = ?
    `).get(id);
    return row ? this.mapUser(row) : null;
  }

  listUsers(): StoredUser[] {
    return this.db.prepare(`
      SELECT id, username, full_name, email, role, password_hash, is_active, preferred_language, last_login_at, created_at
      FROM users ORDER BY username COLLATE NOCASE
    `).all().map((row) => this.mapUser(row));
  }

  insertUser(user: StoredUser): void {
    this.db.prepare(`
      INSERT INTO users (id, username, full_name, email, role, password_hash, is_active, preferred_language, last_login_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id, user.username, user.fullName, user.email, user.role, user.passwordHash,
      user.isActive ? 1 : 0, user.preferredLanguage, user.lastLoginAt || null, user.createdAt,
    );
  }

  insertUserIfEmpty(user: StoredUser): boolean {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.hasUsers()) {
        this.db.exec('COMMIT');
        return false;
      }
      this.insertUser(user);
      this.db.exec('COMMIT');
      return true;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  updateUser(user: StoredUser): void {
    this.db.prepare(`
      UPDATE users SET username = ?, full_name = ?, email = ?, role = ?, password_hash = ?, is_active = ?, preferred_language = ?, last_login_at = ?
      WHERE id = ?
    `).run(
      user.username, user.fullName, user.email, user.role, user.passwordHash,
      user.isActive ? 1 : 0, user.preferredLanguage, user.lastLoginAt || null, user.id,
    );
  }

  appendAuditLog(log: StoredAuditLog): void {
    this.insertAuditLog(log);
  }

  private insertAuditLog(log: StoredAuditLog): void {
    this.db.prepare(`
      INSERT INTO audit_log (id, timestamp, user_id, user_role, action, entity, entity_id, before_state, after_state, reference_id, transaction_id, ip_address, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      log.id, log.timestamp, log.userId, log.userRole, log.action, log.entity, log.entityId,
      log.beforeState || null, log.afterState || null, log.referenceId || null, log.transactionId || null,
      log.ipAddress || null, log.deviceId || null,
    );
  }

  listAuditLogs(limit = 500): StoredAuditLog[] {
    return this.db.prepare(`
      SELECT id, timestamp, user_id, user_role, action, entity, entity_id, before_state, after_state, reference_id, transaction_id, ip_address, device_id
      FROM audit_log ORDER BY timestamp DESC LIMIT ?
    `).all(Math.max(1, Math.min(limit, 5000))).map((row) => ({
      id: String(row.id), timestamp: String(row.timestamp), userId: String(row.user_id), userRole: String(row.user_role),
      action: String(row.action), entity: String(row.entity), entityId: String(row.entity_id),
      beforeState: row.before_state == null ? undefined : String(row.before_state),
      afterState: row.after_state == null ? undefined : String(row.after_state),
      referenceId: row.reference_id == null ? undefined : String(row.reference_id),
      transactionId: row.transaction_id == null ? undefined : String(row.transaction_id),
      ipAddress: row.ip_address == null ? undefined : String(row.ip_address),
      deviceId: row.device_id == null ? undefined : String(row.device_id),
    }));
  }

  isLoginBlocked(key: string, now = Date.now(), windowMs = 15 * 60_000, maxFailures = 5): boolean {
    const row = this.db.prepare('SELECT window_started_at, failures FROM login_throttle WHERE throttle_key = ?').get(key);
    if (!row) return false;
    if (now - Number(row.window_started_at) >= windowMs) {
      this.db.prepare('DELETE FROM login_throttle WHERE throttle_key = ?').run(key);
      return false;
    }
    return Number(row.failures) >= maxFailures;
  }

  recordLoginFailure(key: string, now = Date.now(), windowMs = 15 * 60_000): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT window_started_at, failures FROM login_throttle WHERE throttle_key = ?').get(key);
      if (!row || now - Number(row.window_started_at) >= windowMs) {
        this.db.prepare(`
          INSERT INTO login_throttle (throttle_key, window_started_at, failures)
          VALUES (?, ?, 1)
          ON CONFLICT(throttle_key) DO UPDATE SET window_started_at = excluded.window_started_at, failures = excluded.failures
        `).run(key, now);
      } else {
        this.db.prepare('UPDATE login_throttle SET failures = failures + 1 WHERE throttle_key = ?').run(key);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  clearLoginFailures(key: string): void {
    this.db.prepare('DELETE FROM login_throttle WHERE throttle_key = ?').run(key);
  }

  listSocialConnections(): StoredSocialConnection[] {
    return this.db.prepare('SELECT data_json FROM social_connections ORDER BY platform_id').all()
      .map((row) => JSON.parse(String(row.data_json)) as StoredSocialConnection);
  }

  upsertSocialConnection(connection: StoredSocialConnection): StoredSocialConnection {
    const normalized: StoredSocialConnection = {
      platformId: connection.platformId,
      connected: false,
      assistedReady: Boolean(connection.accountLabel?.trim() || connection.assistedReady),
      accountLabel: connection.accountLabel?.trim() || undefined,
      connectedAt: undefined,
      lastOpenedAt: connection.lastOpenedAt,
    };
    this.db.prepare(`
      INSERT INTO social_connections (platform_id, data_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(platform_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
    `).run(normalized.platformId, JSON.stringify(normalized), nowIso());
    return normalized;
  }

  markSocialConnectionOpened(platformId: string): StoredSocialConnection {
    const current = this.db.prepare('SELECT data_json FROM social_connections WHERE platform_id = ?').get(platformId);
    const previous = current ? JSON.parse(String(current.data_json)) as StoredSocialConnection : { platformId, connected: false };
    return this.upsertSocialConnection({ ...previous, lastOpenedAt: nowIso() });
  }

  listSocialDrafts(limit = 500): StoredSocialDraft[] {
    return this.db.prepare('SELECT data_json FROM social_drafts ORDER BY updated_at DESC LIMIT ?').all(Math.max(1, Math.min(limit, 5000)))
      .map((row) => JSON.parse(String(row.data_json)) as StoredSocialDraft);
  }

  getSocialDraft(id: string): StoredSocialDraft | null {
    const row = this.db.prepare('SELECT data_json FROM social_drafts WHERE id = ?').get(id);
    return row ? JSON.parse(String(row.data_json)) as StoredSocialDraft : null;
  }

  upsertSocialDraft(draft: StoredSocialDraft): StoredSocialDraft {
    this.db.prepare(`
      INSERT INTO social_drafts (id, status, updated_at, data_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at, data_json = excluded.data_json
    `).run(draft.id, draft.status, draft.updatedAt, JSON.stringify(draft));
    return draft;
  }

  deleteSocialDraft(id: string): boolean {
    const result = this.db.prepare('DELETE FROM social_drafts WHERE id = ?').run(id);
    return Number(result.changes || 0) > 0;
  }

  close(): void {
    this.db.close();
  }

  private mapUser(row: any): StoredUser {
    return {
      id: String(row.id), username: String(row.username), fullName: String(row.full_name), email: String(row.email),
      role: String(row.role), passwordHash: String(row.password_hash), isActive: Number(row.is_active) === 1,
      preferredLanguage: String(row.preferred_language), lastLoginAt: row.last_login_at == null ? undefined : String(row.last_login_at),
      createdAt: String(row.created_at),
    };
  }
}

export function defaultDatabasePath(): string {
  const dataDir = process.env.FATHI_DATA_DIR || path.join(process.cwd(), 'data');
  return path.join(dataDir, 'fathi-aqua-erp.sqlite');
}
