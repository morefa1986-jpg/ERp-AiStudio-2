import { describe, expect, it } from 'vitest';
import { BACKUP_SCHEMA_VERSION, checksumBackupData, validateBackupDocument } from '../utils/backupEngine';
import { validateMutationScope, validateStateSnapshot } from '../utils/stateIntegrity';

const baseState = () => ({
  halls: [], ponds: [], species: [], feedingRecords: [], biometricSessions: [], waterLogs: [], mortalityRecords: [],
  treatments: [], transfers: [], broodstock: [], fertilizations: [], incubators: [], larvae: [], nurseryTanks: [],
  inventory: [], inventoryTxs: [], labSamples: [], processingBatches: [], coldStorage: [], customers: [], proformas: [],
  officeDocuments: [], gatePasses: [], accounts: [], journals: [], employees: [], attendance: [], payrolls: [], equipment: [], socialPosts: [],
  auditLogs: [], backups: [],
});

const document = {
  id: 'doc_1',
  indicatorNumber: 'IND-2026-00001',
  documentNumber: 'OUT-24',
  documentDate: '2026-08-25',
  registeredAt: '2026-08-25T08:00:00.000Z',
  direction: 'Outgoing (صادره)',
  type: 'Invoice (فاکتور)',
  subject: 'Export invoice archive',
  sender: 'دفتر مرکزی',
  receiver: 'Customer',
  confidentiality: 'Normal',
  priority: 'Normal',
  status: 'Registered',
  tags: ['invoice'],
  summary: 'Original and PDF files registered.',
  attachments: [
    { id: 'att_1', kind: 'Original File (اصل فایل)', fileName: 'invoice.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 1200, addedAt: '2026-08-25T08:00:00.000Z' },
    { id: 'att_2', kind: 'PDF Copy (نسخه PDF)', fileName: 'invoice.pdf', mimeType: 'application/pdf', sizeBytes: 2400, addedAt: '2026-08-25T08:00:00.000Z' },
  ],
  workflowEvents: [],
  createdBy: 'Admin',
};

describe('office document registry', () => {
  it('allows document-only mutations under the documents module', () => {
    const previous = baseState();
    const next = { ...previous, officeDocuments: [document], auditLogs: [{ id: 'audit_1' }] };
    expect(validateMutationScope(previous, next, { module: 'documents', action: 'create' })).toEqual({ ok: true });
    expect(validateStateSnapshot(next).ok).toBe(true);
  });

  it('includes the office document collection in encrypted-backup validation', () => {
    const data = { ...baseState(), officeDocuments: [document] };
    expect(validateBackupDocument({ schemaVersion: BACKUP_SCHEMA_VERSION, data, checksum: checksumBackupData(data) }).ok).toBe(true);
  });

  it('allows admin branding settings to be managed through the documents module', () => {
    const previous = baseState();
    const officeSettings = [{ id: 'office-branding-default', companyNameFa: 'فتحی', companyNameEn: 'Fathi', registrationLine: '', addressLine: '', phoneLine: '', emailLine: '', websiteLine: '', invoiceFooterNote: '', letterFooterNote: '', logoDataUrl: 'data:image/png;base64,AA==', updatedAt: '2026-08-25T08:00:00.000Z', updatedBy: 'Admin' }];
    const next = { ...previous, officeSettings, auditLogs: [{ id: 'audit_2' }] };
    expect(validateMutationScope(previous, next, { module: 'documents', action: 'manage' })).toEqual({ ok: true });
    expect(validateStateSnapshot(next).ok).toBe(true);
  });
});
