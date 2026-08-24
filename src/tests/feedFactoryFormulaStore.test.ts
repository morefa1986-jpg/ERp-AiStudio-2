import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { FeedFactoryFormulaStore } from '../../server/feedFactoryFormulaStore';

describe('feed factory formula persistence', () => {
  it('persists formula revisions and deterministic event history', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fathi-feed-formula-'));
    const db = path.join(dir, 'erp.sqlite');
    const store = new FeedFactoryFormulaStore(db);
    const created = store.create({
      code: 'F-001', name: 'Formula 1', outputName: 'Feed 3mm', outputSkuBase: 'FEED-3MM', outputUnit: 'kg', basisOutputKg: 100,
      ingredients: [{ itemId: 'raw-a', quantityKg: 105 }], isActive: true,
    }, 'operator-a');
    const updated = store.update(created.id, { name: 'Formula 1 rev B', isActive: false }, 'operator-b');
    expect(updated).toMatchObject({ id: created.id, name: 'Formula 1 rev B', isActive: false, updatedBy: 'operator-b' });
    store.close();

    const reopened = new FeedFactoryFormulaStore(db);
    expect(reopened.get(created.id)).toMatchObject({ name: 'Formula 1 rev B', isActive: false });
    const events = reopened.events(created.id);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ eventType: 'UPDATED', actor: 'operator-b' });
    expect(events[1]).toMatchObject({ eventType: 'CREATED', actor: 'operator-a' });
    reopened.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('enforces unique formula code case-insensitively', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fathi-feed-formula-'));
    const db = path.join(dir, 'erp.sqlite');
    const store = new FeedFactoryFormulaStore(db);
    const payload = { code: 'F-001', name: 'Formula', outputName: 'Feed', outputSkuBase: 'FD', outputUnit: 'kg', basisOutputKg: 100, ingredients: [{ itemId: 'raw-a', quantityKg: 100 }], isActive: true };
    store.create(payload, 'operator');
    expect(() => store.create({ ...payload, code: 'f-001' }, 'operator')).toThrow();
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
