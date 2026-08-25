export interface DurableStateOutbox {
  userId: string;
  writeId: string;
  baseVersion: number;
  baseState: Record<string, unknown> | null;
  localState: Record<string, unknown>;
  operation: Record<string, unknown>;
  savedAt: string;
}

const DB_NAME = 'fathi_erp_state_outbox_v1';
const STORE_NAME = 'outbox';
const FALLBACK_PREFIX = 'fathi_erp_state_outbox_v1:';
const FALLBACK_MAX_BYTES = 4 * 1024 * 1024;

function fallbackKey(userId: string): string {
  return `${FALLBACK_PREFIX}${userId}`;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('INDEXED_DB_UNAVAILABLE'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('INDEXED_DB_OPEN_FAILED'));
  });
}

async function idbPut(record: DurableStateOutbox): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('INDEXED_DB_WRITE_FAILED'));
    tx.onabort = () => reject(tx.error || new Error('INDEXED_DB_WRITE_ABORTED'));
  });
  db.close();
}

async function idbGet(userId: string): Promise<DurableStateOutbox | null> {
  const db = await openDb();
  const result = await new Promise<DurableStateOutbox | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(userId);
    request.onsuccess = () => resolve((request.result as DurableStateOutbox | undefined) || null);
    request.onerror = () => reject(request.error || new Error('INDEXED_DB_READ_FAILED'));
  });
  db.close();
  return result;
}

async function idbDelete(userId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('INDEXED_DB_DELETE_FAILED'));
  });
  db.close();
}

function fallbackPut(record: DurableStateOutbox): void {
  if (typeof localStorage === 'undefined') return;
  const serialized = JSON.stringify(record);
  if (new Blob([serialized]).size > FALLBACK_MAX_BYTES) throw new Error('OUTBOX_FALLBACK_TOO_LARGE');
  localStorage.setItem(fallbackKey(record.userId), serialized);
}

function fallbackGet(userId: string): DurableStateOutbox | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(fallbackKey(userId));
  if (!raw) return null;
  try { return JSON.parse(raw) as DurableStateOutbox; } catch { return null; }
}

function fallbackDelete(userId: string): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(fallbackKey(userId));
}

export async function saveStateOutbox(input: Omit<DurableStateOutbox, 'writeId' | 'savedAt'>): Promise<DurableStateOutbox> {
  const record: DurableStateOutbox = { ...input, writeId: randomId(), savedAt: new Date().toISOString() };
  try {
    await idbPut(record);
    try { fallbackDelete(record.userId); } catch { /* best effort */ }
  } catch {
    fallbackPut(record);
  }
  return record;
}

export async function loadStateOutbox(userId: string): Promise<DurableStateOutbox | null> {
  if (!userId) return null;
  try {
    const record = await idbGet(userId);
    return record || fallbackGet(userId);
  } catch {
    return fallbackGet(userId);
  }
}

export async function clearStateOutbox(userId: string, expectedWriteId?: string): Promise<boolean> {
  if (!userId) return false;
  const current = await loadStateOutbox(userId);
  if (!current) return true;
  if (expectedWriteId && current.writeId !== expectedWriteId) return false;
  try { await idbDelete(userId); } catch { /* fallback below */ }
  try { fallbackDelete(userId); } catch { /* best effort */ }
  return true;
}
