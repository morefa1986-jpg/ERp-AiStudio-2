import crypto from 'crypto';
import path from 'path';
import { createRequire } from 'module';
import { defaultDatabasePath } from './storage';

export type CitesPermitStatus = 'ACTIVE' | 'REVOKED' | 'SUSPENDED';

export interface CitesPermitRecord {
  id: string;
  permitNumber: string;
  batchCode: string;
  speciesName: string;
  productScope: 'CAVIAR' | 'STURGEON_PRODUCT';
  destinationCountry?: string;
  issueDate: string;
  expiryDate: string;
  status: CitesPermitStatus;
  issuerReference: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CitesValidationInput {
  permitNumber: string;
  batchCode: string;
  destinationCountry?: string;
  shipmentDate: string;
}

export interface CitesValidationResult {
  valid: boolean;
  error?: string;
  permit?: CitesPermitRecord;
}

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { get(...params: unknown[]): any; all(...params: unknown[]): any[]; run(...params: unknown[]): { changes?: number } };
  close(): void;
};

const nodeRequire = createRequire(typeof __filename === 'string' ? __filename : path.join(process.cwd(), 'server', 'citesRegistry.ts'));
const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: new (filename: string) => SqliteDatabase };

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function validDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime());
}
function mapRow(row: any): CitesPermitRecord {
  return {
    id: String(row.id), permitNumber: String(row.permit_number), batchCode: String(row.batch_code), speciesName: String(row.species_name),
    productScope: row.product_scope, destinationCountry: row.destination_country ? String(row.destination_country) : undefined,
    issueDate: String(row.issue_date), expiryDate: String(row.expiry_date), status: row.status, issuerReference: String(row.issuer_reference || ''),
    notes: String(row.notes || ''), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

export class CitesRegistryStore {
  private readonly db: SqliteDatabase;
  constructor(filename = defaultDatabasePath()) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS cites_permits (
        id TEXT PRIMARY KEY,
        permit_number TEXT UNIQUE NOT NULL,
        batch_code TEXT NOT NULL,
        species_name TEXT NOT NULL,
        product_scope TEXT NOT NULL CHECK(product_scope IN ('CAVIAR','STURGEON_PRODUCT')),
        destination_country TEXT,
        issue_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('ACTIVE','REVOKED','SUSPENDED')),
        issuer_reference TEXT NOT NULL,
        notes TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cites_batch ON cites_permits(batch_code, status, expiry_date);
    `);
  }

  list(): CitesPermitRecord[] {
    return this.db.prepare('SELECT * FROM cites_permits ORDER BY updated_at DESC').all().map(mapRow);
  }
  getById(id: string): CitesPermitRecord | null {
    const row = this.db.prepare('SELECT * FROM cites_permits WHERE id=?').get(id); return row ? mapRow(row) : null;
  }
  getByPermitNumber(permitNumber: string): CitesPermitRecord | null {
    const row = this.db.prepare('SELECT * FROM cites_permits WHERE permit_number=?').get(clean(permitNumber, 160)); return row ? mapRow(row) : null;
  }

  create(raw: any): CitesPermitRecord {
    const permitNumber = clean(raw?.permitNumber, 160);
    const batchCode = clean(raw?.batchCode, 160);
    const speciesName = clean(raw?.speciesName, 200);
    const productScope = raw?.productScope === 'STURGEON_PRODUCT' ? 'STURGEON_PRODUCT' : raw?.productScope === 'CAVIAR' ? 'CAVIAR' : '';
    const destinationCountry = clean(raw?.destinationCountry, 120) || undefined;
    const issueDate = clean(raw?.issueDate, 10);
    const expiryDate = clean(raw?.expiryDate, 10);
    const issuerReference = clean(raw?.issuerReference, 300);
    const notes = clean(raw?.notes, 1200);
    if (!permitNumber || !batchCode || !speciesName || !productScope || !issuerReference) throw new Error('CITES_REQUIRED_FIELDS');
    if (!validDateKey(issueDate) || !validDateKey(expiryDate) || expiryDate < issueDate) throw new Error('CITES_DATE_RANGE_INVALID');
    const now = new Date().toISOString();
    const permit: CitesPermitRecord = { id: `cites_${crypto.randomUUID()}`, permitNumber, batchCode, speciesName, productScope, destinationCountry, issueDate, expiryDate, status: 'ACTIVE', issuerReference, notes, createdAt: now, updatedAt: now };
    try {
      this.db.prepare('INSERT INTO cites_permits (id, permit_number, batch_code, species_name, product_scope, destination_country, issue_date, expiry_date, status, issuer_reference, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(permit.id, permit.permitNumber, permit.batchCode, permit.speciesName, permit.productScope, permit.destinationCountry || null, permit.issueDate, permit.expiryDate, permit.status, permit.issuerReference, permit.notes, now, now);
    } catch { throw new Error('CITES_PERMIT_DUPLICATE'); }
    return this.getById(permit.id)!;
  }

  setStatus(id: string, status: CitesPermitStatus): CitesPermitRecord {
    if (!['ACTIVE','REVOKED','SUSPENDED'].includes(status)) throw new Error('CITES_STATUS_INVALID');
    if (!this.getById(id)) throw new Error('CITES_PERMIT_NOT_FOUND');
    this.db.prepare('UPDATE cites_permits SET status=?, updated_at=? WHERE id=?').run(status, new Date().toISOString(), id);
    return this.getById(id)!;
  }

  validate(input: CitesValidationInput): CitesValidationResult {
    const permit = this.getByPermitNumber(input.permitNumber);
    if (!permit) return { valid: false, error: 'CITES_PERMIT_NOT_REGISTERED' };
    if (permit.status !== 'ACTIVE') return { valid: false, error: `CITES_PERMIT_${permit.status}` };
    const batchCode = clean(input.batchCode, 160);
    if (!batchCode || permit.batchCode.toLowerCase() !== batchCode.toLowerCase()) return { valid: false, error: 'CITES_BATCH_MISMATCH' };
    const shipmentDate = clean(input.shipmentDate, 10);
    if (!validDateKey(shipmentDate)) return { valid: false, error: 'CITES_SHIPMENT_DATE_INVALID' };
    if (shipmentDate < permit.issueDate) return { valid: false, error: 'CITES_NOT_YET_VALID' };
    if (shipmentDate > permit.expiryDate) return { valid: false, error: 'CITES_PERMIT_EXPIRED' };
    const destination = clean(input.destinationCountry, 120);
    if (permit.destinationCountry && destination && permit.destinationCountry.toLowerCase() !== destination.toLowerCase()) return { valid: false, error: 'CITES_DESTINATION_MISMATCH' };
    if (permit.destinationCountry && !destination) return { valid: false, error: 'CITES_DESTINATION_REQUIRED' };
    return { valid: true, permit };
  }

  close(): void { this.db.close(); }
}
