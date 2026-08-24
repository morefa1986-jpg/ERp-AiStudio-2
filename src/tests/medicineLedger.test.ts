import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { MedicineLedgerStore } from '../../server/medicineLedger';

const created: string[] = [];
function store() {
  const filename = path.join(os.tmpdir(), `fathi-med-ledger-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
  created.push(filename);
  return new MedicineLedgerStore(filename);
}
afterEach(() => { for (const file of created.splice(0)) { for (const suffix of ['', '-wal', '-shm']) try { fs.rmSync(file + suffix, { force: true }); } catch {} } });

describe('medicine lot compliance ledger', () => {
  it('tracks lot receipt, recorded administration and remaining quantity without dose calculation', () => {
    const db = store();
    const lot = db.createLot({ medicineName: 'Record Only Medicine', lotNumber: 'LOT-001', expiryDate: '2027-08-24', supplier: 'Test Supplier', receivedQuantity: 10, unit: 'unit' });
    const record = db.recordAdministration({ treatmentId: 'treatment_1', pondId: 'pond_1', lotId: lot.id, quantityRecorded: 2.5, unit: 'unit', timestamp: '2026-08-24T05:00:00Z', recordedBy: 'Veterinarian' });
    expect(record).toMatchObject({ treatmentId: 'treatment_1', pondId: 'pond_1', lotNumber: 'LOT-001', quantityRecorded: 2.5, unit: 'unit' });
    expect(db.getLot(lot.id)).toMatchObject({ receivedQuantity: 10, administeredQuantity: 2.5, remainingQuantity: 7.5 });
    db.close();
  });

  it('rejects duplicate lots, unit mismatch and consumption beyond remaining stock', () => {
    const db = store();
    const lot = db.createLot({ medicineName: 'Medicine A', lotNumber: 'LOT-X', expiryDate: '2027-01-01', supplier: 'Supplier', receivedQuantity: 1, unit: 'bottle' });
    expect(() => db.createLot({ medicineName: 'Medicine A', lotNumber: 'LOT-X', expiryDate: '2027-01-01', supplier: 'Supplier', receivedQuantity: 1, unit: 'bottle' })).toThrow('MEDICINE_LOT_DUPLICATE');
    expect(() => db.recordAdministration({ treatmentId: 't1', pondId: 'p1', lotId: lot.id, quantityRecorded: 0.5, unit: 'ml', timestamp: '2026-08-24T05:00:00Z', recordedBy: 'Vet' })).toThrow('MEDICINE_ADMIN_UNIT_MISMATCH');
    expect(() => db.recordAdministration({ treatmentId: 't1', pondId: 'p1', lotId: lot.id, quantityRecorded: 2, unit: 'bottle', timestamp: '2026-08-24T05:00:00Z', recordedBy: 'Vet' })).toThrow('MEDICINE_LOT_INSUFFICIENT_REMAINING');
    db.close();
  });

  it('prevents administration from an inactive or expired lot', () => {
    const db = store();
    const expired = db.createLot({ medicineName: 'Medicine B', lotNumber: 'OLD', expiryDate: '2026-01-01', supplier: 'Supplier', receivedQuantity: 5, unit: 'unit' });
    expect(() => db.recordAdministration({ treatmentId: 't2', pondId: 'p2', lotId: expired.id, quantityRecorded: 1, unit: 'unit', timestamp: '2026-08-24T05:00:00Z', recordedBy: 'Vet' })).toThrow('MEDICINE_LOT_EXPIRED_AT_ADMINISTRATION');
    const active = db.createLot({ medicineName: 'Medicine C', lotNumber: 'NEW', expiryDate: '2027-01-01', supplier: 'Supplier', receivedQuantity: 5, unit: 'unit' });
    db.setLotActive(active.id, false);
    expect(() => db.recordAdministration({ treatmentId: 't3', pondId: 'p3', lotId: active.id, quantityRecorded: 1, unit: 'unit', timestamp: '2026-08-24T05:00:00Z', recordedBy: 'Vet' })).toThrow('MEDICINE_LOT_NOT_ACTIVE');
    db.close();
  });
});
