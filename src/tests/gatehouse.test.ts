import { describe, expect, it } from 'vitest';
import { roleAllows } from '../utils/rbac';
import { BACKUP_SCHEMA_VERSION, checksumBackupData, validateBackupDocument } from '../utils/backupEngine';
import { STATE_COLLECTIONS, validateMutationScope, validateStateSnapshot } from '../utils/stateIntegrity';

function emptyState() {
  return Object.fromEntries(STATE_COLLECTIONS.map((key) => [key, []])) as Record<string, any>;
}

const gatePass = {
  id: 'gate_1',
  passNumber: 'GP-2026-00001',
  direction: 'Exit (خروج)',
  status: 'Approved for Exit',
  registeredAt: '2026-08-25T09:30:00.000Z',
  vehiclePlateNumber: 'ایران 12 - 345 ع 67',
  vehicleType: 'کامیون یخچال‌دار',
  driverName: 'راننده تست',
  driverNationalId: '0012345678',
  driverPhone: '09120000000',
  cargoOwnerName: 'صاحب کالا تست',
  cargoOwnerNationalId: '0098765432',
  cargoOwnerPhone: '09121111111',
  cargoType: 'خاویار بسته‌بندی',
  cargoVolume: '25 کیلوگرم',
  cargoQuality: 'درجه ممتاز',
  waybillNumber: 'WB-1001',
  dispatchOrderNumber: 'DO-2002',
  transportPermitNumber: 'TP-3003',
  originAddress: 'دفتر مرکزی / سردخانه',
  destinationAddress: 'مشتری تهران',
  registeredBy: 'Gate Guard',
};

describe('gatehouse entry/exit automation', () => {
  it('grants gatehouse operations to guard and office automation users only within their scope', () => {
    expect(roleAllows('Gate Guard', 'gatehouse', 'create')).toBe(true);
    expect(roleAllows('Gate Guard', 'gatehouse', 'print')).toBe(true);
    expect(roleAllows('Gate Guard', 'accounting', 'view')).toBe(false);

    expect(roleAllows('Office Automation', 'gatehouse', 'create')).toBe(true);
    expect(roleAllows('Office Automation', 'documents', 'view')).toBe(true);
    expect(roleAllows('Office Automation', 'accounting', 'edit')).toBe(false);
  });

  it('allows gatehouse-only mutations with audit logs', () => {
    const previous = emptyState();
    const next = { ...previous, gatePasses: [gatePass], auditLogs: [{ id: 'audit_gate_1' }] };
    expect(validateMutationScope(previous, next, { module: 'gatehouse', action: 'create' })).toEqual({ ok: true });
    expect(validateStateSnapshot(next).ok).toBe(true);
  });

  it('persists gate passes in encrypted backup validation', () => {
    const data = { ...emptyState(), gatePasses: [gatePass] };
    expect(validateBackupDocument({ schemaVersion: BACKUP_SCHEMA_VERSION, data, checksum: checksumBackupData(data) }).ok).toBe(true);
  });
});
