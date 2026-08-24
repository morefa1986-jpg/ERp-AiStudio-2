import crypto from 'crypto';
import path from 'path';
import { createRequire } from 'module';
import { defaultDatabasePath } from './storage';
import type { FeedFormulaDefinition, FeedFormulaIngredient } from '../src/utils/feedFactoryEngine';

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { get(...params: unknown[]): any; all(...params: unknown[]): any[]; run(...params: unknown[]): { changes?: number } };
  close(): void;
};

export interface StoredFeedFormula extends FeedFormulaDefinition {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface FeedFormulaEvent {
  id: string;
  formulaId: string;
  eventType: 'CREATED' | 'UPDATED';
  timestamp: string;
  actor: string;
  snapshot: StoredFeedFormula;
}

const nodeRequire = createRequire(typeof __filename === 'string' ? __filename : path.join(process.cwd(), 'server', 'feedFactoryFormulaStore.ts'));
const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: new (filename: string) => SqliteDatabase };

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanIngredient(raw: any): FeedFormulaIngredient {
  return { itemId: clean(raw?.itemId, 160), quantityKg: Number(raw?.quantityKg) };
}

function mapRow(row: any): StoredFeedFormula {
  return JSON.parse(String(row.data_json)) as StoredFeedFormula;
}

export class FeedFactoryFormulaStore {
  private readonly db: SqliteDatabase;

  constructor(filename = defaultDatabasePath()) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS feed_factory_formulas (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL COLLATE NOCASE UNIQUE,
        is_active INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        data_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_feed_factory_formulas_active ON feed_factory_formulas(is_active, updated_at DESC);
      CREATE TABLE IF NOT EXISTS feed_factory_formula_events (
        id TEXT PRIMARY KEY,
        formula_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        actor TEXT NOT NULL,
        data_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_feed_factory_formula_events_formula ON feed_factory_formula_events(formula_id, timestamp DESC, rowid DESC);
    `);
  }

  list(): StoredFeedFormula[] {
    return this.db.prepare('SELECT data_json FROM feed_factory_formulas ORDER BY updated_at DESC, rowid DESC').all().map(mapRow);
  }

  get(id: string): StoredFeedFormula | null {
    const row = this.db.prepare('SELECT data_json FROM feed_factory_formulas WHERE id = ?').get(clean(id, 160));
    return row ? mapRow(row) : null;
  }

  getByCode(code: string): StoredFeedFormula | null {
    const row = this.db.prepare('SELECT data_json FROM feed_factory_formulas WHERE code = ? COLLATE NOCASE').get(clean(code, 100));
    return row ? mapRow(row) : null;
  }

  create(raw: any, actor: string): StoredFeedFormula {
    const now = new Date().toISOString();
    const formula: StoredFeedFormula = {
      id: `feedformula_${crypto.randomUUID()}`,
      code: clean(raw?.code, 100),
      name: clean(raw?.name, 200),
      outputName: clean(raw?.outputName, 200),
      outputSkuBase: clean(raw?.outputSkuBase, 100),
      outputUnit: raw?.outputUnit === 'gram' ? 'gram' : 'kg',
      basisOutputKg: Number(raw?.basisOutputKg),
      ingredients: Array.isArray(raw?.ingredients) ? raw.ingredients.slice(0, 100).map(cleanIngredient) : [],
      isActive: raw?.isActive !== false,
      createdAt: now,
      updatedAt: now,
      createdBy: clean(actor, 200),
      updatedBy: clean(actor, 200),
    };
    if (!formula.code || !formula.name || !formula.outputName || !formula.outputSkuBase || !formula.createdBy) throw new Error('FEED_FORMULA_FIELDS_INVALID');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO feed_factory_formulas (id, code, is_active, updated_at, data_json) VALUES (?, ?, ?, ?, ?)')
        .run(formula.id, formula.code, formula.isActive ? 1 : 0, now, JSON.stringify(formula));
      this.appendEvent(formula, 'CREATED', actor, now);
      this.db.exec('COMMIT');
      return formula;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  update(id: string, raw: any, actor: string): StoredFeedFormula {
    const existing = this.get(id);
    if (!existing) throw new Error('FEED_FORMULA_NOT_FOUND');
    const now = new Date().toISOString();
    const formula: StoredFeedFormula = {
      ...existing,
      code: raw?.code === undefined ? existing.code : clean(raw.code, 100),
      name: raw?.name === undefined ? existing.name : clean(raw.name, 200),
      outputName: raw?.outputName === undefined ? existing.outputName : clean(raw.outputName, 200),
      outputSkuBase: raw?.outputSkuBase === undefined ? existing.outputSkuBase : clean(raw.outputSkuBase, 100),
      outputUnit: raw?.outputUnit === undefined ? existing.outputUnit : raw.outputUnit === 'gram' ? 'gram' : 'kg',
      basisOutputKg: raw?.basisOutputKg === undefined ? existing.basisOutputKg : Number(raw.basisOutputKg),
      ingredients: raw?.ingredients === undefined ? existing.ingredients : Array.isArray(raw.ingredients) ? raw.ingredients.slice(0, 100).map(cleanIngredient) : [],
      isActive: raw?.isActive === undefined ? existing.isActive : Boolean(raw.isActive),
      updatedAt: now,
      updatedBy: clean(actor, 200),
    };
    if (!formula.code || !formula.name || !formula.outputName || !formula.outputSkuBase || !formula.updatedBy) throw new Error('FEED_FORMULA_FIELDS_INVALID');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('UPDATE feed_factory_formulas SET code = ?, is_active = ?, updated_at = ?, data_json = ? WHERE id = ?')
        .run(formula.code, formula.isActive ? 1 : 0, now, JSON.stringify(formula), formula.id);
      this.appendEvent(formula, 'UPDATED', actor, now);
      this.db.exec('COMMIT');
      return formula;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  events(formulaId: string, limit = 200): FeedFormulaEvent[] {
    const rows = this.db.prepare('SELECT data_json FROM feed_factory_formula_events WHERE formula_id = ? ORDER BY timestamp DESC, rowid DESC LIMIT ?')
      .all(clean(formulaId, 160), Math.max(1, Math.min(1000, Number(limit) || 200)));
    return rows.flatMap((row) => {
      try { return [JSON.parse(String(row.data_json)) as FeedFormulaEvent]; } catch { return []; }
    });
  }

  private appendEvent(formula: StoredFeedFormula, eventType: FeedFormulaEvent['eventType'], actor: string, timestamp: string): void {
    const event: FeedFormulaEvent = {
      id: `feedformulaevt_${crypto.randomUUID()}`,
      formulaId: formula.id,
      eventType,
      timestamp,
      actor: clean(actor, 200),
      snapshot: formula,
    };
    this.db.prepare('INSERT INTO feed_factory_formula_events (id, formula_id, event_type, timestamp, actor, data_json) VALUES (?, ?, ?, ?, ?, ?)')
      .run(event.id, event.formulaId, event.eventType, event.timestamp, event.actor, JSON.stringify(event));
  }

  close(): void { this.db.close(); }
}
