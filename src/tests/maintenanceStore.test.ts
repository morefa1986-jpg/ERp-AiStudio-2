import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { MaintenanceStore } from '../../server/maintenanceStore';

const dirs: string[] = [];
function tempDb(): string { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fathi-maint-')); dirs.push(dir); return path.join(dir, 'erp.sqlite'); }
afterEach(() => { while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true }); });

function createOrder(store: MaintenanceStore) {
  return store.create({
    code: 'WO-001', equipmentId: 'eq-1', equipmentCode: 'PUMP-1', equipmentName: 'Pump 1', type: 'Corrective', priority: 'High',
    description: 'Investigate pump failure', assignedTechnician: 'Tech', plannedDate: '2026-08-24', createdBy: 'Manager', failureReason: 'Unexpected stop',
  });
}

describe('maintenance work order store', () => {
  it('runs create → start → complete with downtime and cost conservation', () => {
    const store = new MaintenanceStore(tempDb());
    const created = createOrder(store);
    expect(created.status).toBe('OPEN');
    const started = store.start(created.id, 'Tech');
    expect(started.status).toBe('IN_PROGRESS');
    const completed = store.complete(created.id, {
      actor: 'Manager', resolution: 'Bearing replaced', downtimeHours: 2.5, laborCost: 150,
      parts: [{ name: 'Bearing', quantity: 2, unit: 'pcs', unitCost: 40 }, { name: 'Seal', quantity: 1, unit: 'pcs', unitCost: 15 }],
      nextServiceDate: '2026-09-24',
    });
    expect(completed).toMatchObject({ status: 'COMPLETED', downtimeHours: 2.5, laborCost: 150, partsCost: 95, totalCost: 245, nextServiceDate: '2026-09-24' });
    expect(store.events(created.id).map((event) => event.eventType)).toEqual(['COMPLETED', 'STARTED', 'CREATED']);
    store.close();
  });

  it('rejects completion before work is started and rejects negative costs', () => {
    const store = new MaintenanceStore(tempDb());
    const created = createOrder(store);
    expect(() => store.complete(created.id, { actor: 'Manager', resolution: 'x', downtimeHours: 0, laborCost: 0, parts: [] })).toThrow('MAINTENANCE_NOT_IN_PROGRESS');
    store.start(created.id, 'Tech');
    expect(() => store.complete(created.id, { actor: 'Manager', resolution: 'x', downtimeHours: -1, laborCost: 0, parts: [] })).toThrow('MAINTENANCE_COMPLETION_INVALID');
    store.close();
  });
});
