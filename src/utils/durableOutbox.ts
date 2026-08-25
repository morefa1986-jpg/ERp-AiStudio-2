import { PermissionAction, PermissionModule } from '../types';
import { changedStateCollections, MODULE_COLLECTIONS } from './stateIntegrity';

export type DurableStateOperation = {
  module: PermissionModule;
  action: PermissionAction;
  entity?: string;
  entityId?: string;
  referenceId?: string;
  transactionId?: string;
};

export interface DurableOutboxEntry {
  id: string;
  userId: string;
  sequence: number;
  operation: DurableStateOperation;
  state: Record<string, unknown>;
  createdAt: string;
}

export interface DurableReplayResult {
  status: 'empty' | 'replayed' | 'offline' | 'blocked';
  replayed: number;
  remaining: number;
  error?: string;
}

const DB_NAME = 'fathi-aqua-supererp-offline';
const DB_VERSION = 1;
const STORE_NAME = 'state_outbox';
const MAX_ENTRIES_PER_USER = 1000;

const MODULE_PRIORITY: PermissionModule[] = [
  'feeding', 'water_quality', 'mortality', 'biometrics', 'treatments', 'transfers',
  'processing', 'sales', 'documents', 'accounting', 'hr', 'warehouse', 'feed_factory', 'hatchery',
  'nursery', 'laboratory', 'crm', 'media', 'backup', 'settings',
];

const COLLECTION_HINTS: Array<{ collection: string; module: PermissionModule }> = [
  { collection: 'feedingRecords', module: 'feeding' },
  { collection: 'waterLogs', module: 'water_quality' },
  { collection: 'mortalityRecords', module: 'mortality' },
  { collection: 'biometricSessions', module: 'biometrics' },
  { collection: 'treatments', module: 'treatments' },
  { collection: 'transfers', module: 'transfers' },
  { collection: 'processingBatches', module: 'processing' },
  { collection: 'proformas', module: 'sales' },
  { collection: 'officeDocuments', module: 'documents' },
  { collection: 'officeSettings', module: 'documents' },
  { collection: 'journals', module: 'accounting' },
  { collection: 'attendance', module: 'hr' },
  { collection: 'payrolls', module: 'hr' },
  { collection: 'inventoryTxs', module: 'warehouse' },
  { collection: 'fertilizations', module: 'hatchery' },
  { collection: 'broodstock', module: 'hatchery' },
  { collection: 'incubators', module: 'hatchery' },
  { collection: 'nurseryTanks', module: 'nursery' },
  { collection: 'larvae', module: 'nursery' },
  { collection: 'labSamples', module: 'laboratory' },
  { collection: 'customers', module: 'crm' },
  { collection: 'socialPosts', module: 'media' },
];

function meaningfulCollections(previous: Record<string, unknown>, next: Record<string, unknown>): string[] {
  return changedStateCollections(previous, next).filter((key) => key !== 'auditLogs' && key !== 'backups');
}

export function inferDurableOperation(previous: Record<string, unknown>, next: Record<string, unknown>): DurableStateOperation | null {
  const changed = meaningfulCollections(previous, next);
  if (!changed.length) return null;

  for (const hint of COLLECTION_HINTS) {
    if (!changed.includes(hint.collection)) continue;
    const allowed = MODULE_COLLECTIONS[hint.module] || [];
    if (changed.every((key) => allowed.includes(key))) {
      return { module: hint.module, action: 'edit', entity: hint.collection };
    }
  }

  for (const module of MODULE_PRIORITY) {
    const allowed = MODULE_COLLECTIONS[module] || [];
    if (changed.every((key) => allowed.includes(key))) {
      return { module, action: module === 'settings' ? 'manage' : 'edit', entity: changed[0] };
    }
  }
  return null;
}

export function fallbackDurableOperation(): DurableStateOperation {
  return { module: 'settings', action: 'edit', entity: 'DurableRecoveryUnknown' };
}

function indexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase | null> {
  if (!indexedDbAvailable()) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('sequence', 'sequence', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('OUTBOX_DB_OPEN_FAILED'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = work(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('OUTBOX_DB_REQUEST_FAILED'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error || new Error('OUTBOX_DB_TX_FAILED')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('OUTBOX_DB_TX_ABORTED')); };
  });
}

export async function loadDurableEntries(userId: string): Promise<DurableOutboxEntry[]> {
  if (!userId) return [];
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('userId');
    const request = index.getAll(IDBKeyRange.only(userId));
    request.onsuccess = () => {
      const rows = (Array.isArray(request.result) ? request.result : []) as DurableOutboxEntry[];
      resolve(rows.sort((a, b) => a.sequence - b.sequence));
    };
    request.onerror = () => reject(request.error || new Error('OUTBOX_LOAD_FAILED'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error || new Error('OUTBOX_LOAD_TX_FAILED')); };
  });
}

export async function appendDurableEntry(userId: string, operation: DurableStateOperation, state: Record<string, unknown>): Promise<DurableOutboxEntry | null> {
  if (!userId) return null;
  const existing = await loadDurableEntries(userId);
  const sequence = existing.length ? existing[existing.length - 1].sequence + 1 : Date.now() * 1000;
  const randomId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const entry: DurableOutboxEntry = {
    id: `${userId}:${randomId}`,
    userId,
    sequence,
    operation,
    state,
    createdAt: new Date().toISOString(),
  };
  await withStore('readwrite', (store) => store.put(entry));
  const rows = await loadDurableEntries(userId);
  if (rows.length > MAX_ENTRIES_PER_USER) {
    const excess = rows.slice(0, rows.length - MAX_ENTRIES_PER_USER);
    for (const row of excess) await deleteDurableEntry(row.id);
  }
  return entry;
}

export async function deleteDurableEntry(id: string): Promise<void> {
  if (!id) return;
  await withStore('readwrite', (store) => store.delete(id));
}

export async function clearDurableEntries(userId: string): Promise<void> {
  const rows = await loadDurableEntries(userId);
  for (const row of rows) await deleteDurableEntry(row.id);
}

export async function trimDurableEntriesToCount(userId: string, count: number): Promise<void> {
  const target = Math.max(0, Math.floor(count));
  const rows = await loadDurableEntries(userId);
  const removeCount = Math.max(0, rows.length - target);
  for (const row of rows.slice(0, removeCount)) await deleteDurableEntry(row.id);
}

let writeChain: Promise<void> = Promise.resolve();
export function queueDurableWrite(task: () => Promise<void>): void {
  writeChain = writeChain.then(task).catch(() => {});
}

async function fetchCurrentVersion(token: string): Promise<{ ok: boolean; version: number | null; error?: string }> {
  try {
    const response = await fetch('/api/state', { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) return { ok: false, version: null, error: payload.error || `STATE_LOAD_${response.status}` };
    return { ok: true, version: payload.state ? Number(payload.state.version) : null };
  } catch {
    return { ok: false, version: null, error: 'NETWORK_OFFLINE' };
  }
}

export async function replayDurableEntries(userId: string, token: string): Promise<DurableReplayResult> {
  const rows = await loadDurableEntries(userId);
  if (!rows.length) return { status: 'empty', replayed: 0, remaining: 0 };
  if (!token) return { status: 'blocked', replayed: 0, remaining: rows.length, error: 'AUTH_REQUIRED' };

  const current = await fetchCurrentVersion(token);
  if (!current.ok) {
    return { status: current.error === 'NETWORK_OFFLINE' ? 'offline' : 'blocked', replayed: 0, remaining: rows.length, error: current.error };
  }

  let version = current.version;
  let replayed = 0;
  for (const row of rows) {
    let attempts = 0;
    while (attempts < 4) {
      attempts += 1;
      try {
        const response = await fetch('/api/state', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: row.state, version, operation: row.operation }),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          const conflictVersion = payload?.state?.version;
          if (Number.isFinite(Number(conflictVersion))) {
            version = Number(conflictVersion);
            continue;
          }
          const refreshed = await fetchCurrentVersion(token);
          if (!refreshed.ok) return { status: refreshed.error === 'NETWORK_OFFLINE' ? 'offline' : 'blocked', replayed, remaining: rows.length - replayed, error: refreshed.error };
          version = refreshed.version;
          continue;
        }
        if (!response.ok || !payload.success) {
          const status = response.status >= 500 || response.status === 429 ? 'offline' : 'blocked';
          return { status, replayed, remaining: rows.length - replayed, error: payload.error || `OUTBOX_REPLAY_${response.status}` };
        }
        version = Number(payload.state?.version);
        await deleteDurableEntry(row.id);
        replayed += 1;
        break;
      } catch {
        return { status: 'offline', replayed, remaining: rows.length - replayed, error: 'NETWORK_OFFLINE' };
      }
    }
    if (attempts >= 4) return { status: 'blocked', replayed, remaining: rows.length - replayed, error: 'OUTBOX_CONFLICT_RETRY_EXHAUSTED' };
  }
  return { status: 'replayed', replayed, remaining: 0 };
}
