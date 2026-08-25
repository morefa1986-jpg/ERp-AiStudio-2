import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { defaultDatabasePath } from './storage';

export type LocalFileCategory = 'chat' | 'mortality' | 'laboratory' | 'crm';

const CATEGORY_MAX_BYTES: Record<LocalFileCategory, number> = {
  chat: 32 * 1024 * 1024,
  mortality: 8 * 1024 * 1024,
  laboratory: 12 * 1024 * 1024,
  crm: 16 * 1024 * 1024,
};

export interface StoredLocalFile {
  storageId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storedAt: string;
  category: LocalFileCategory;
}

export function maxBytesForCategory(category: LocalFileCategory): number {
  return CATEGORY_MAX_BYTES[category];
}

function storageRoot(category: LocalFileCategory): string {
  return path.join(path.dirname(defaultDatabasePath()), 'erp-files', category);
}

function safeName(name: string): string {
  return path.basename(name).replace(/\.\./g, '_').replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/\s+/g, '-').slice(0, 120) || 'file.bin';
}

export function isLocalFileCategory(value: string): value is LocalFileCategory {
  return value === 'chat' || value === 'mortality' || value === 'laboratory' || value === 'crm';
}

export function storeLocalFile(category: LocalFileCategory, input: { fileName: string; mimeType?: string; base64: string }): StoredLocalFile {
  const clean = String(input.base64 || '').replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(clean, 'base64');
  if (!buffer.length) throw new Error('LOCAL_FILE_EMPTY');
  if (buffer.length > CATEGORY_MAX_BYTES[category]) throw new Error('LOCAL_FILE_TOO_LARGE');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const storedAt = new Date().toISOString();
  const storageId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${safeName(input.fileName)}`;
  const root = storageRoot(category);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, storageId), buffer, { flag: 'wx' });
  return { storageId, originalName: input.fileName, mimeType: input.mimeType || 'application/octet-stream', sizeBytes: buffer.length, sha256, storedAt, category };
}

export function resolveLocalFile(category: LocalFileCategory, storageId: string): string | null {
  const name = path.basename(storageId);
  if (!name || name !== storageId) return null;
  const target = path.join(storageRoot(category), name);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return null;
  return target;
}
