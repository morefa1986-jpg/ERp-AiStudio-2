import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { LaboratoryLedgerStore } from '../../server/laboratoryLedger';

const tempDirs: string[] = [];
function tempDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fathi-lab-ledger-'));
  tempDirs.push(dir);
  return path.join(dir, 'erp.sqlite');
}

afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('laboratory workflow ledger', () => {
  it('persists sample/result/approval history including critical count', () => {
    const filename = tempDb();
    const store = new LaboratoryLedgerStore(filename);
    store.append({ sampleId: 'lab-1', sampleCode: 'S-001', eventType: 'SAMPLE_CREATED', actor: 'Lab User', notes: 'registered', criticalCount: 0 });
    store.append({ sampleId: 'lab-1', sampleCode: 'S-001', eventType: 'RESULTS_RECORDED', actor: 'Lab User', notes: 'verified values', criticalCount: 1 });
    store.append({ sampleId: 'lab-1', sampleCode: 'S-001', eventType: 'APPROVED', actor: 'Lab Manager', notes: 'record verified', criticalCount: 1 });
    store.close();

    const reopened = new LaboratoryLedgerStore(filename);
    const events = reopened.list(10, 'lab-1');
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ eventType: 'APPROVED', criticalCount: 1 });
    expect(events[1]).toMatchObject({ eventType: 'RESULTS_RECORDED', criticalCount: 1 });
    expect(events[2]).toMatchObject({ eventType: 'SAMPLE_CREATED', criticalCount: 0 });
    reopened.close();
  });

  it('rejects events without sample identity', () => {
    const store = new LaboratoryLedgerStore(tempDb());
    expect(() => store.append({ sampleId: '', sampleCode: 'S-001', eventType: 'REJECTED', actor: 'Lab Manager', notes: 'invalid' })).toThrow('LAB_EVENT_REQUIRED_FIELDS');
    store.close();
  });
});
