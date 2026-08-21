import { BackupSnapshot } from '../types';
import { sha256 } from './sha256';

export const BACKUP_SCHEMA_VERSION = 2;

export function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function checksumBackupData(data: Record<string, unknown>): string {
  return `SHA-256:${sha256(JSON.stringify(data))}`;
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

  const required = [
    'halls', 'ponds', 'species', 'feedingRecords', 'biometricSessions', 'waterLogs', 'mortalityRecords',
    'treatments', 'transfers', 'broodstock', 'fertilizations', 'incubators', 'larvae', 'nurseryTanks',
    'inventory', 'inventoryTxs', 'labSamples', 'processingBatches', 'coldStorage', 'customers', 'proformas',
    'accounts', 'journals', 'employees', 'attendance', 'payrolls', 'equipment', 'socialPosts', 'auditLogs',
  ];
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

export interface EncryptedBackupEnvelope {
  format: 'FATHI_ERP_ENCRYPTED_BACKUP';
  schemaVersion: number;
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

const BACKUP_KDF_ITERATIONS = 310_000;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveBackupKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!passphrase || passphrase.length < 12) throw new Error('BACKUP_PASSPHRASE_TOO_SHORT');
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: BACKUP_KDF_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBackupDocument(document: BackupSnapshot, passphrase: string): Promise<EncryptedBackupEnvelope> {
  if (!globalThis.crypto?.subtle) throw new Error('BACKUP_CRYPTO_UNAVAILABLE');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(document));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { format: 'FATHI_ERP_ENCRYPTED_BACKUP', schemaVersion: BACKUP_SCHEMA_VERSION, kdf: 'PBKDF2-SHA-256', iterations: BACKUP_KDF_ITERATIONS, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptBackupDocument(input: unknown, passphrase: string): Promise<{ ok: boolean; error?: string; data?: Record<string, any> }> {
  try {
    if (!isObject(input) || input.format !== 'FATHI_ERP_ENCRYPTED_BACKUP' || input.kdf !== 'PBKDF2-SHA-256') return { ok: false, error: 'ENCRYPTED_BACKUP_FORMAT_INVALID' };
    if (Number(input.schemaVersion) !== BACKUP_SCHEMA_VERSION || Number(input.iterations) !== BACKUP_KDF_ITERATIONS) return { ok: false, error: 'UNSUPPORTED_BACKUP_SCHEMA' };
    const salt = fromBase64(String(input.salt));
    const iv = fromBase64(String(input.iv));
    const key = await deriveBackupKey(passphrase, salt);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromBase64(String(input.ciphertext)));
    const parsed = JSON.parse(new TextDecoder().decode(plaintext));
    const validation = validateBackupDocument(parsed);
    return validation.ok && validation.data ? { ok: true, data: validation.data } : { ok: false, error: validation.error || 'BACKUP_INVALID' };
  } catch {
    return { ok: false, error: 'BACKUP_DECRYPTION_FAILED' };
  }
}
