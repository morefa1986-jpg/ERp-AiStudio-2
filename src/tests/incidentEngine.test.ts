import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { deriveOperationalIncidents, IncidentStore } from '../../server/incidentEngine';

const files: string[] = [];
function store() { const file = path.join(os.tmpdir(), `fathi-incidents-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`); files.push(file); return new IncidentStore(file); }
afterEach(() => { for (const file of files.splice(0)) for (const suffix of ['', '-wal', '-shm']) try { fs.rmSync(file + suffix, { force: true }); } catch {} });

function state(now: number) {
  return {
    ponds: [
      { id: 'pond_1', hallId: 'hall_1', name: 'Pond 1', isActive: true, feedingStatus: 'ACTIVE' },
      { id: 'pond_2', hallId: 'hall_2', name: 'Pond 2', isActive: true, feedingStatus: 'STOPPED', stopFeedingReason: 'Disease', stopFeedingDetails: 'Operational record' },
    ],
    waterLogs: [
      { id: 'w1', pondId: 'pond_1', timestamp: new Date(now - 5 * 60_000).toISOString(), sensorStatus: 'VALID', dissolvedOxygen: 3.5, temperature: 16, ph: 7.5, ammonia: 0.01, nitrite: 0.1 },
      { id: 'w2', pondId: 'pond_2', timestamp: new Date(now - 30 * 60_000).toISOString(), sensorStatus: 'VALID', dissolvedOxygen: 7, temperature: 16, ph: 7.5, ammonia: 0.01, nitrite: 0.1 },
    ],
    inventory: [{ id: 'inv_1', name: 'Feed X', sku: 'FX', quantity: 2, unit: 'kg', status: 'Critical Low' }],
  } as Record<string, unknown>;
}

describe('operational incident engine', () => {
  it('derives critical water, stale telemetry, disease feeding stop and critical inventory incidents', () => {
    const now = new Date('2026-08-24T05:00:00Z').getTime();
    const incidents = deriveOperationalIncidents(state(now), now);
    expect(incidents.some((row) => row.fingerprint === 'water:pond_1:unsafe' && row.severity === 'CRITICAL')).toBe(true);
    expect(incidents.some((row) => row.fingerprint === 'water:pond_2:telemetry-untrusted' && row.severity === 'HIGH')).toBe(true);
    expect(incidents.some((row) => row.fingerprint === 'feeding:pond_2:Disease' && row.severity === 'HIGH')).toBe(true);
    expect(incidents.some((row) => row.fingerprint === 'inventory:inv_1:Critical Low')).toBe(true);
  });

  it('deduplicates, acknowledges, escalates and resolves incidents with an audit-ready state', () => {
    const db = store();
    const candidates = [{ fingerprint: 'water:p1:unsafe', sourceType: 'WATER_QUALITY' as const, entityId: 'w1', pondId: 'p1', hallId: 'h1', severity: 'CRITICAL' as const, title: 'Unsafe', details: 'Low DO' }];
    const first = db.syncCandidates(candidates, '2026-08-24T05:00:00Z');
    expect(first).toHaveLength(1);
    const id = first[0].id;
    expect(db.syncCandidates(candidates, '2026-08-24T05:01:00Z')).toHaveLength(1);
    expect(db.acknowledge(id, 'Manager')).toMatchObject({ status: 'ACKNOWLEDGED', acknowledgedBy: 'Manager' });
    expect(db.escalate(id, 'Manager')).toMatchObject({ status: 'ACKNOWLEDGED', escalationLevel: 1 });
    expect(db.resolve(id, 'Manager', 'Corrective action recorded')).toMatchObject({ status: 'RESOLVED', resolutionNote: 'Corrective action recorded' });
    db.close();
  });

  it('auto-resolves conditions no longer detected and reopens them if they recur', () => {
    const db = store();
    const candidate = { fingerprint: 'feeding:p1:Disease', sourceType: 'FEEDING' as const, entityId: 'p1', pondId: 'p1', hallId: 'h1', severity: 'HIGH' as const, title: 'Stopped', details: 'Disease' };
    const id = db.syncCandidates([candidate], '2026-08-24T05:00:00Z')[0].id;
    db.syncCandidates([], '2026-08-24T05:10:00Z');
    expect(db.get(id)).toMatchObject({ status: 'RESOLVED', resolvedBy: 'SYSTEM' });
    db.syncCandidates([candidate], '2026-08-24T05:20:00Z');
    expect(db.get(id)).toMatchObject({ status: 'OPEN', resolvedBy: undefined });
    db.close();
  });
});
