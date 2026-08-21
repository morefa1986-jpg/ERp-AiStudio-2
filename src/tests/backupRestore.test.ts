import { describe, expect, it } from 'vitest';
import { BACKUP_SCHEMA_VERSION, checksumBackupData, decryptBackupDocument, encryptBackupDocument, validateBackupDocument } from '../utils/backupEngine';

function makeData() {
  return {
    halls: [{ id: 'hall_1', number: '1', name: 'Hall 1' }],
    species: [{ id: 'sp_1', scientificName: 'Huso huso' }],
    ponds: [{ id: 'pond_1', hallId: 'hall_1', speciesId: 'sp_1', fishCount: 100, biomassKg: 400 }],
    inventory: [{ id: 'inv_1', sku: 'FEED-1', quantity: 100 }],
    accounts: [{ id: 'acc_1' }],
    journals: [],
    feedingRecords: [], biometricSessions: [], waterLogs: [], mortalityRecords: [], treatments: [], transfers: [],
    broodstock: [], fertilizations: [], incubators: [], larvae: [], nurseryTanks: [], inventoryTxs: [], labSamples: [],
    processingBatches: [], coldStorage: [], customers: [], proformas: [], employees: [], attendance: [], payrolls: [],
    equipment: [], socialPosts: [], auditLogs: [],
  };
}

describe('Backup integrity engine', () => {
  it('accepts a versioned snapshot with an intact checksum and linked pond references', () => {
    const data = makeData();
    const document = { schemaVersion: BACKUP_SCHEMA_VERSION, checksum: checksumBackupData(data), data };
    expect(validateBackupDocument(document).ok).toBe(true);
  });

  it('rejects tampered data after checksum creation', () => {
    const data = makeData();
    const document = { schemaVersion: BACKUP_SCHEMA_VERSION, checksum: checksumBackupData(data), data };
    data.ponds[0].fishCount = 999;
    expect(validateBackupDocument(document)).toMatchObject({ ok: false, error: 'BACKUP_CHECKSUM_MISMATCH' });
  });

  it('rejects missing core collections, negative stock and broken pond references', () => {
    const missing = { schemaVersion: BACKUP_SCHEMA_VERSION, checksum: 'x', data: { ponds: [] } };
    expect(validateBackupDocument(missing).ok).toBe(false);

    const badStock = makeData();
    badStock.inventory[0].quantity = -1;
    expect(validateBackupDocument({ schemaVersion: BACKUP_SCHEMA_VERSION, checksum: checksumBackupData(badStock), data: badStock }).ok).toBe(false);

    const brokenRef = makeData();
    brokenRef.ponds[0].hallId = 'missing_hall';
    expect(validateBackupDocument({ schemaVersion: BACKUP_SCHEMA_VERSION, checksum: checksumBackupData(brokenRef), data: brokenRef }).ok).toBe(false);
  });

  it('encrypts sensitive backup content and rejects the wrong passphrase', async () => {
    const data = makeData();
    const document = { schemaVersion: BACKUP_SCHEMA_VERSION, checksum: checksumBackupData(data), data } as any;
    const envelope = await encryptBackupDocument(document, 'correct horse battery staple');
    expect(envelope.format).toBe('FATHI_ERP_ENCRYPTED_BACKUP');
    expect((await decryptBackupDocument(envelope, 'wrong passphrase')).ok).toBe(false);
    expect((await decryptBackupDocument(envelope, 'correct horse battery staple')).ok).toBe(true);
  });

  it('rejects encrypted envelope metadata downgrade or iteration tampering', async () => {
    const data = makeData();
    const document = { schemaVersion: BACKUP_SCHEMA_VERSION, checksum: checksumBackupData(data), data } as any;
    const envelope = await encryptBackupDocument(document, 'correct horse battery staple');
    expect((await decryptBackupDocument({ ...envelope, iterations: 1 }, 'correct horse battery staple')).error).toBe('UNSUPPORTED_BACKUP_SCHEMA');
  });
});
