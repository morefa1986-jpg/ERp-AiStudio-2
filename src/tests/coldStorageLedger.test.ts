import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { ColdStorageLedgerStore } from '../../server/coldStorageLedger';

const tempDirs: string[] = [];

function tempDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fathi-cold-storage-'));
  tempDirs.push(dir);
  return path.join(dir, 'erp.sqlite');
}

afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('cold storage structured ledger', () => {
  it('persists move and temperature-check events in FIFO history', () => {
    const filename = tempDb();
    const store = new ColdStorageLedgerStore(filename);
    store.append({ palletId: 'lot-1', batchCode: 'B-1', eventType: 'MOVE', actor: 'Operator', notes: '', previousSlotCode: 'A-1', nextSlotCode: 'A-2' });
    store.append({ palletId: 'lot-1', batchCode: 'B-1', eventType: 'TEMPERATURE_CHECK', actor: 'Operator', notes: 'manual check', temperatureC: -1, minAllowedC: -4, maxAllowedC: 0, withinRange: true });
    store.close();

    const reopened = new ColdStorageLedgerStore(filename);
    const events = reopened.list(10, 'lot-1');
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ eventType: 'TEMPERATURE_CHECK', temperatureC: -1, withinRange: true });
    expect(events[1]).toMatchObject({ eventType: 'MOVE', previousSlotCode: 'A-1', nextSlotCode: 'A-2' });
    reopened.close();
  });

  it('fails closed when required event identity is missing', () => {
    const store = new ColdStorageLedgerStore(tempDb());
    expect(() => store.append({ palletId: '', batchCode: 'B-1', eventType: 'QUALITY_HOLD', actor: 'Operator', notes: '', reason: 'test' })).toThrow('COLD_STORAGE_EVENT_REQUIRED_FIELDS');
    store.close();
  });
});
