import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { defaultDatabasePath } from './storage';

export const MAX_OFFICE_FILE_BYTES = 8 * 1024 * 1024;

export interface StoredOfficeFile {
  storageId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storedAt: string;
}

function storageRoot(): string {
  return path.join(path.dirname(defaultDatabasePath()), 'office-documents');
}

function safeName(name: string): string {
  return path.basename(name).replace(/\.\./g, '_').replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/\s+/g, '-').slice(0, 120) || 'document.bin';
}

export function storeOfficeDocumentFile(input: { fileName: string; mimeType?: string; base64: string }): StoredOfficeFile {
  const clean = String(input.base64 || '').replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(clean, 'base64');
  if (!buffer.length) throw new Error('DOCUMENT_FILE_EMPTY');
  if (buffer.length > MAX_OFFICE_FILE_BYTES) throw new Error('DOCUMENT_FILE_TOO_LARGE');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const storedAt = new Date().toISOString();
  const storageId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${safeName(input.fileName)}`;
  const root = storageRoot();
  fs.mkdirSync(root, { recursive: true });
  const target = path.join(root, storageId);
  fs.writeFileSync(target, buffer, { flag: 'wx' });
  return { storageId, originalName: input.fileName, mimeType: input.mimeType || 'application/octet-stream', sizeBytes: buffer.length, sha256, storedAt };
}

export function resolveOfficeDocumentFile(storageId: string): string | null {
  const name = path.basename(storageId);
  if (!name || name !== storageId) return null;
  const target = path.join(storageRoot(), name);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return null;
  return target;
}
