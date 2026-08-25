import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveOfficeDocumentFile, storeOfficeDocumentFile } from '../../server/officeDocumentFiles';

let tempDir = '';

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = '';
  delete process.env.FATHI_DATA_DIR;
});

describe('office document file storage', () => {
  it('stores uploaded bytes outside user-controlled paths and resolves by storage id', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fathi-office-files-'));
    process.env.FATHI_DATA_DIR = tempDir;
    const stored = storeOfficeDocumentFile({ fileName: '../../invoice.pdf', mimeType: 'application/pdf', base64: Buffer.from('pdf-body').toString('base64') });
    expect(stored.storageId).not.toContain('..');
    const resolved = resolveOfficeDocumentFile(stored.storageId);
    expect(resolved).toBeTruthy();
    expect(fs.readFileSync(resolved!, 'utf8')).toBe('pdf-body');
    expect(resolveOfficeDocumentFile('../outside')).toBeNull();
  });
});
