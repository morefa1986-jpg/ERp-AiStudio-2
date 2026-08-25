import { describe, expect, it } from 'vitest';
import { threeWayMergeState } from '../utils/stateConflictMerge';

function state(overrides: Record<string, unknown> = {}) {
  return {
    halls: [{ id: 'hall-1', name: 'Hall', pondCount: 2, totalFishCount: 200, totalBiomassKg: 200 }],
    ponds: [
      { id: 'pond-1', fishCount: 100, biomassKg: 100, lastFeedingKg: 0 },
      { id: 'pond-2', fishCount: 100, biomassKg: 100, lastFeedingKg: 0 },
    ],
    feedingRecords: [],
    auditLogs: [],
    ...overrides,
  };
}

describe('three-way ERP state merge', () => {
  it('merges independent additions without dropping either client record', () => {
    const base = state();
    const local = state({ feedingRecords: [{ id: 'feed-local', pondId: 'pond-1' }] });
    const remote = state({ feedingRecords: [{ id: 'feed-remote', pondId: 'pond-2' }] });
    const result = threeWayMergeState(base, local, remote);
    expect(result.ok).toBe(true);
    expect((result.state?.feedingRecords as Array<{ id: string }>).map((row) => row.id).sort()).toEqual(['feed-local', 'feed-remote']);
  });

  it('merges edits to different pond rows', () => {
    const base = state();
    const local = state({ ponds: [
      { id: 'pond-1', fishCount: 100, biomassKg: 100, lastFeedingKg: 2 },
      { id: 'pond-2', fishCount: 100, biomassKg: 100, lastFeedingKg: 0 },
    ] });
    const remote = state({ ponds: [
      { id: 'pond-1', fishCount: 100, biomassKg: 100, lastFeedingKg: 0 },
      { id: 'pond-2', fishCount: 99, biomassKg: 99, lastFeedingKg: 0 },
    ] });
    const result = threeWayMergeState(base, local, remote);
    expect(result.ok).toBe(true);
    const ponds = result.state?.ponds as Array<Record<string, number | string>>;
    expect(ponds.find((row) => row.id === 'pond-1')?.lastFeedingKg).toBe(2);
    expect(ponds.find((row) => row.id === 'pond-2')?.fishCount).toBe(99);
  });

  it('fails closed when both clients change the same row differently', () => {
    const base = state();
    const local = state({ ponds: [
      { id: 'pond-1', fishCount: 100, biomassKg: 100, lastFeedingKg: 2 },
      { id: 'pond-2', fishCount: 100, biomassKg: 100, lastFeedingKg: 0 },
    ] });
    const remote = state({ ponds: [
      { id: 'pond-1', fishCount: 99, biomassKg: 99, lastFeedingKg: 0 },
      { id: 'pond-2', fishCount: 100, biomassKg: 100, lastFeedingKg: 0 },
    ] });
    const result = threeWayMergeState(base, local, remote);
    expect(result.ok).toBe(false);
    expect(result.conflicts).toContainEqual({ collection: 'ponds', entityId: 'pond-1', reason: 'BOTH_CHANGED' });
  });

  it('fails closed on delete versus remote change', () => {
    const base = state();
    const local = state({ ponds: [{ id: 'pond-2', fishCount: 100, biomassKg: 100, lastFeedingKg: 0 }] });
    const remote = state({ ponds: [
      { id: 'pond-1', fishCount: 98, biomassKg: 98, lastFeedingKg: 0 },
      { id: 'pond-2', fishCount: 100, biomassKg: 100, lastFeedingKg: 0 },
    ] });
    const result = threeWayMergeState(base, local, remote);
    expect(result.ok).toBe(false);
    expect(result.conflicts[0]).toMatchObject({ collection: 'ponds', entityId: 'pond-1', reason: 'DELETE_VS_CHANGE' });
  });

  it('keeps remote hall aggregates because the server recalculates them from merged ponds', () => {
    const base = state();
    const local = state({ halls: [{ id: 'hall-1', name: 'Hall', pondCount: 2, totalFishCount: 190, totalBiomassKg: 190 }] });
    const remote = state({ halls: [{ id: 'hall-1', name: 'Hall', pondCount: 2, totalFishCount: 195, totalBiomassKg: 195 }] });
    const result = threeWayMergeState(base, local, remote);
    expect(result.ok).toBe(true);
    expect(result.state?.halls).toEqual(remote.halls);
  });
});
