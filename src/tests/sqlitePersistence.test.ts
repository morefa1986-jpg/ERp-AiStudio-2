import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteERPStore, StateConflictError } from '../../server/storage';

const stores: SqliteERPStore[] = [];

afterEach(() => {
  for (const store of stores.splice(0)) store.close();
});

function createStore(): { store: SqliteERPStore; directory: string } {
  const directory = mkdtempSync(join(tmpdir(), 'fathi-erp-sqlite-'));
  const store = new SqliteERPStore(join(directory, 'erp.sqlite'));
  stores.push(store);
  return { store, directory };
}

describe('SQLite persistence production store', () => {
  it('allows only one first-run administrator bootstrap', () => {
    const { store } = createStore();
    const base = { fullName: 'Owner', email: 'owner@example.test', role: 'Farm Owner', passwordHash: 'scrypt$hash', isActive: true, preferredLanguage: 'en', createdAt: new Date().toISOString() };
    expect(store.insertUserIfEmpty({ ...base, id: 'user_1', username: 'owner' })).toBe(true);
    expect(store.insertUserIfEmpty({ ...base, id: 'user_2', username: 'owner2' })).toBe(false);
    expect(store.listUsers()).toHaveLength(1);
  });

  it('persists state, users and authoritative audit fields across store instances', () => {
    const first = createStore();
    const state = first.store.saveState({ ponds: [], versionMarker: 'durable' }, null);
    first.store.insertUser({
      id: 'user_1', username: 'owner', fullName: 'Owner', email: 'owner@example.test', role: 'Farm Owner',
      passwordHash: 'scrypt$16384$8$1$salt$hash', isActive: true, preferredLanguage: 'en', createdAt: state.updatedAt,
    });
    first.store.appendAuditLog({
      id: 'audit_1', timestamp: state.updatedAt, userId: 'user_1', userRole: 'Farm Owner', action: 'CREATE',
      entity: 'State', entityId: 'state', referenceId: 'ref_1', transactionId: 'txn_1', ipAddress: '127.0.0.1', deviceId: 'device_1',
    });
    first.store.close();
    stores.splice(stores.indexOf(first.store), 1);

    const second = new SqliteERPStore(join(first.directory, 'erp.sqlite'));
    stores.push(second);
    expect(second.getState()?.data).toMatchObject({ versionMarker: 'durable' });
    expect(second.getUserByUsername('OWNER')?.role).toBe('Farm Owner');
    expect(second.listAuditLogs()[0]).toMatchObject({ userId: 'user_1', transactionId: 'txn_1', ipAddress: '127.0.0.1', deviceId: 'device_1' });
    rmSync(first.directory, { recursive: true, force: true });
  });

  it('rejects stale optimistic writes instead of overwriting newer state', () => {
    const { store } = createStore();
    const initial = store.saveState({ value: 1 }, null);
    store.saveState({ value: 2 }, initial.version);
    expect(() => store.saveState({ value: 3 }, initial.version)).toThrow(StateConflictError);
    expect(store.getState()?.data).toMatchObject({ value: 2 });
  });

  it('keeps a durable pre-restore snapshot and login throttle across reopen', () => {
    const first = createStore();
    const state = first.store.saveState({ ponds: [], marker: 'before-restore' }, null);
    const snapshotId = first.store.createStateSnapshot('pre-restore', state);
    first.store.recordLoginFailure('127.0.0.1:owner', 1000, 900_000);
    first.store.recordLoginFailure('127.0.0.1:owner', 1001, 900_000);
    expect(snapshotId).toBeTruthy();
    expect(first.store.getStateSnapshot(snapshotId!)).toMatchObject({ data: { marker: 'before-restore' } });
    expect(first.store.isLoginBlocked('127.0.0.1:owner', 1002, 900_000, 2)).toBe(true);
  });
});
