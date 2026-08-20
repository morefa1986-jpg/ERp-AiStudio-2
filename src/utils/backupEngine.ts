import { BackupSnapshot } from '../types';

export const BACKUP_SCHEMA_VERSION = 1;

export function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function checksumBackupData(data: Record<string, unknown>): string {
  return `FNV1A32:${fnv1a32(JSON.stringify(data))}`;
}

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validIdRows(rows: unknown[]): boolean {
  const ids = rows.map((row) => isObject(row) && typeof row.id === 'string' ? row.id : '');
  return ids.every(Boolean) && new Set(ids).size === ids.length;
}

export function validateBackupDocument(input: unknown): { ok: boolean; error?: string; snapshot?: BackupSnapshot; data?: Record<string, any> } {
  if (!isObject(input)) return { ok: false, error: 'BACKUP_NOT_OBJECT' };
  if (Number(input.schemaVersion) !== BACKUP_SCHEMA_VERSION) return { ok: false, error: 'UNSUPPORTED_BACKUP_SCHEMA' };
  if (!isObject(input.data)) return { ok: false, error: 'BACKUP_DATA_MISSING' };

  const required = ['halls', 'ponds', 'species', 'inventory', 'accounts', 'journals'];
  for (const key of required) {
    const rows = input.data[key];
    if (!Array.isArray(rows) || !validIdRows(rows)) return { ok: false, error: `BACKUP_COLLECTION_INVALID:${key}` };
  }

  const hallIds = new Set(input.data.halls.map((row: any) => row.id));
  const speciesIds = new Set(input.data.species.map((row: any) => row.id));
  for (const pond of input.data.ponds) {
    if (!isObject(pond) || typeof pond.id !== 'string' || !hallIds.has(pond.hallId) || !speciesIds.has(pond.speciesId)) {
      return { ok: false, error: 'BACKUP_POND_REFERENCE_INVALID' };
    }
    if (!Number.isFinite(pond.fishCount) || pond.fishCount < 0 || !Number.isFinite(pond.biomassKg) || pond.biomassKg < 0) {
      return { ok: false, error: 'BACKUP_POND_NUMERIC_INVALID' };
    }
  }

  for (const item of input.data.inventory) {
    if (!isObject(item) || typeof item.sku !== 'string' || !Number.isFinite(item.quantity) || item.quantity < 0) {
      return { ok: false, error: 'BACKUP_INVENTORY_INVALID' };
    }
  }

  if (typeof input.checksum !== 'string' || checksumBackupData(input.data) !== input.checksum) {
    return { ok: false, error: 'BACKUP_CHECKSUM_MISMATCH' };
  }

  return { ok: true, snapshot: input as BackupSnapshot, data: input.data };
}
