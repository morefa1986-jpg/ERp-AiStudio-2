import crypto from 'crypto';
import path from 'path';
import { createRequire } from 'module';
import { defaultDatabasePath } from './storage';

export interface MedicineLot {
  id: string;
  medicineName: string;
  lotNumber: string;
  expiryDate: string;
  supplier: string;
  receivedQuantity: number;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  administeredQuantity?: number;
  remainingQuantity?: number;
}

export interface MedicineAdministration {
  id: string;
  treatmentId: string;
  pondId: string;
  lotId: string;
  medicineName: string;
  lotNumber: string;
  quantityRecorded: number;
  unit: string;
  timestamp: string;
  recordedBy: string;
  notes: string;
  withdrawalEndDate?: string;
}

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { get(...params: unknown[]): any; all(...params: unknown[]): any[]; run(...params: unknown[]): { changes?: number } };
  close(): void;
};

const nodeRequire = createRequire(typeof __filename === 'string' ? __filename : path.join(process.cwd(), 'server', 'medicineLedger.ts'));
const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: new (filename: string) => SqliteDatabase };
const SAFE_UNIT = /^[\p{L}\p{N}%/._ -]{1,32}$/u;

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime());
}

export class MedicineLedgerStore {
  private readonly db: SqliteDatabase;

  constructor(filename = defaultDatabasePath()) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS medicine_lots (
        id TEXT PRIMARY KEY,
        medicine_name TEXT NOT NULL,
        lot_number TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        supplier TEXT NOT NULL,
        received_quantity REAL NOT NULL CHECK(received_quantity >= 0),
        unit TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(medicine_name, lot_number)
      );
      CREATE TABLE IF NOT EXISTS medicine_administrations (
        id TEXT PRIMARY KEY,
        treatment_id TEXT NOT NULL,
        pond_id TEXT NOT NULL,
        lot_id TEXT NOT NULL,
        medicine_name TEXT NOT NULL,
        lot_number TEXT NOT NULL,
        quantity_recorded REAL NOT NULL CHECK(quantity_recorded > 0),
        unit TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        recorded_by TEXT NOT NULL,
        notes TEXT NOT NULL,
        withdrawal_end_date TEXT,
        FOREIGN KEY(lot_id) REFERENCES medicine_lots(id)
      );
      CREATE INDEX IF NOT EXISTS idx_medicine_admin_lot ON medicine_administrations(lot_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_medicine_admin_treatment ON medicine_administrations(treatment_id, timestamp);
    `);
  }

  listLots(): MedicineLot[] {
    const rows = this.db.prepare(`
      SELECT l.*, COALESCE(SUM(a.quantity_recorded), 0) AS administered_quantity
      FROM medicine_lots l LEFT JOIN medicine_administrations a ON a.lot_id = l.id
      GROUP BY l.id ORDER BY l.updated_at DESC
    `).all();
    return rows.map((row) => {
      const received = Number(row.received_quantity);
      const administered = Number(row.administered_quantity || 0);
      return {
        id: String(row.id), medicineName: String(row.medicine_name), lotNumber: String(row.lot_number), expiryDate: String(row.expiry_date),
        supplier: String(row.supplier), receivedQuantity: received, unit: String(row.unit), isActive: Number(row.is_active) === 1,
        createdAt: String(row.created_at), updatedAt: String(row.updated_at), administeredQuantity: administered,
        remainingQuantity: Number((received - administered).toFixed(4)),
      };
    });
  }

  getLot(id: string): MedicineLot | null { return this.listLots().find((row) => row.id === id) || null; }

  createLot(raw: any): MedicineLot {
    const medicineName = clean(raw?.medicineName, 160);
    const lotNumber = clean(raw?.lotNumber, 100);
    const expiryDate = clean(raw?.expiryDate, 10);
    const supplier = clean(raw?.supplier, 200);
    const unit = clean(raw?.unit, 32);
    const receivedQuantity = Number(raw?.receivedQuantity);
    if (!medicineName || !lotNumber || !supplier) throw new Error('MEDICINE_LOT_REQUIRED_FIELDS');
    if (!validDate(expiryDate)) throw new Error('MEDICINE_LOT_EXPIRY_INVALID');
    if (!Number.isFinite(receivedQuantity) || receivedQuantity < 0) throw new Error('MEDICINE_LOT_QUANTITY_INVALID');
    if (!SAFE_UNIT.test(unit)) throw new Error('MEDICINE_LOT_UNIT_INVALID');
    const now = new Date().toISOString();
    const lot: MedicineLot = { id: `medlot_${crypto.randomUUID()}`, medicineName, lotNumber, expiryDate, supplier, receivedQuantity, unit, isActive: true, createdAt: now, updatedAt: now };
    try {
      this.db.prepare('INSERT INTO medicine_lots (id, medicine_name, lot_number, expiry_date, supplier, received_quantity, unit, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)')
        .run(lot.id, medicineName, lotNumber, expiryDate, supplier, receivedQuantity, unit, now, now);
    } catch { throw new Error('MEDICINE_LOT_DUPLICATE'); }
    return this.getLot(lot.id)!;
  }

  setLotActive(id: string, isActive: boolean): MedicineLot {
    const current = this.getLot(id);
    if (!current) throw new Error('MEDICINE_LOT_NOT_FOUND');
    const now = new Date().toISOString();
    this.db.prepare('UPDATE medicine_lots SET is_active = ?, updated_at = ? WHERE id = ?').run(isActive ? 1 : 0, now, id);
    return this.getLot(id)!;
  }

  listAdministrations(limit = 500): MedicineAdministration[] {
    return this.db.prepare('SELECT * FROM medicine_administrations ORDER BY timestamp DESC LIMIT ?').all(Math.max(1, Math.min(2000, limit))).map((row) => ({
      id: String(row.id), treatmentId: String(row.treatment_id), pondId: String(row.pond_id), lotId: String(row.lot_id),
      medicineName: String(row.medicine_name), lotNumber: String(row.lot_number), quantityRecorded: Number(row.quantity_recorded), unit: String(row.unit),
      timestamp: String(row.timestamp), recordedBy: String(row.recorded_by), notes: String(row.notes || ''), withdrawalEndDate: row.withdrawal_end_date ? String(row.withdrawal_end_date) : undefined,
    }));
  }

  recordAdministration(input: { treatmentId: string; pondId: string; lotId: string; quantityRecorded: number; unit: string; timestamp: string; recordedBy: string; notes?: string; withdrawalEndDate?: string }): MedicineAdministration {
    const lot = this.getLot(input.lotId);
    if (!lot || !lot.isActive) throw new Error('MEDICINE_LOT_NOT_ACTIVE');
    if (input.unit !== lot.unit) throw new Error('MEDICINE_ADMIN_UNIT_MISMATCH');
    if (!Number.isFinite(input.quantityRecorded) || input.quantityRecorded <= 0) throw new Error('MEDICINE_ADMIN_QUANTITY_INVALID');
    if ((lot.remainingQuantity ?? 0) + 1e-9 < input.quantityRecorded) throw new Error('MEDICINE_LOT_INSUFFICIENT_REMAINING');
    const administrationDate = new Date(input.timestamp).getTime();
    if (!Number.isFinite(administrationDate)) throw new Error('MEDICINE_ADMIN_TIMESTAMP_INVALID');
    const expiryEnd = new Date(`${lot.expiryDate}T23:59:59.999Z`).getTime();
    if (administrationDate > expiryEnd) throw new Error('MEDICINE_LOT_EXPIRED_AT_ADMINISTRATION');
    const record: MedicineAdministration = {
      id: `medadm_${crypto.randomUUID()}`, treatmentId: clean(input.treatmentId, 160), pondId: clean(input.pondId, 160), lotId: lot.id,
      medicineName: lot.medicineName, lotNumber: lot.lotNumber, quantityRecorded: Number(input.quantityRecorded.toFixed(4)), unit: lot.unit,
      timestamp: new Date(administrationDate).toISOString(), recordedBy: clean(input.recordedBy, 200), notes: clean(input.notes, 1000),
      withdrawalEndDate: input.withdrawalEndDate && validDate(input.withdrawalEndDate) ? input.withdrawalEndDate : undefined,
    };
    if (!record.treatmentId || !record.pondId || !record.recordedBy) throw new Error('MEDICINE_ADMIN_REQUIRED_FIELDS');
    this.db.prepare('INSERT INTO medicine_administrations (id, treatment_id, pond_id, lot_id, medicine_name, lot_number, quantity_recorded, unit, timestamp, recorded_by, notes, withdrawal_end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(record.id, record.treatmentId, record.pondId, record.lotId, record.medicineName, record.lotNumber, record.quantityRecorded, record.unit, record.timestamp, record.recordedBy, record.notes, record.withdrawalEndDate || null);
    return record;
  }

  close(): void { this.db.close(); }
}
