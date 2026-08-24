import { describe, expect, it } from 'vitest';
import {
  allowedPondIds,
  filterRowsByUserScope,
  mergeSubmittedRowsWithinScope,
  validateRequestedUserScope,
  validateSubmittedUserScope,
} from '../../server/stateScope';

const state = {
  halls: [{ id: 'hall-a' }, { id: 'hall-b' }],
  ponds: [
    { id: 'pond-a1', hallId: 'hall-a' },
    { id: 'pond-a2', hallId: 'hall-a' },
    { id: 'pond-b1', hallId: 'hall-b' },
  ],
  feedingRecords: [
    { id: 'feed-a', pondId: 'pond-a1' },
    { id: 'feed-b', pondId: 'pond-b1' },
  ],
  transfers: [
    { id: 'tr-a', sourceType: 'Pond', sourceId: 'pond-a1', destinationType: 'Pond', destinationId: 'pond-a2' },
    { id: 'tr-cross', sourceType: 'Pond', sourceId: 'pond-a1', destinationType: 'Pond', destinationId: 'pond-b1' },
  ],
};

const hallManager = { id: 'u1', role: 'Hall Manager', hallScope: ['hall-a'], pondScope: [] };

describe('server state scoping', () => {
  it('derives allowed ponds from hall scope', () => {
    expect([...allowedPondIds(state, hallManager)!].sort()).toEqual(['pond-a1', 'pond-a2']);
  });

  it('filters pond-linked ledgers and hides cross-scope transfers', () => {
    expect((filterRowsByUserScope('feedingRecords', state.feedingRecords, state, hallManager) as any[]).map((row) => row.id)).toEqual(['feed-a']);
    expect((filterRowsByUserScope('transfers', state.transfers, state, hallManager) as any[]).map((row) => row.id)).toEqual(['tr-a']);
  });

  it('preserves hidden rows when a scoped client saves its visible collection', () => {
    const submitted = [{ id: 'feed-a', pondId: 'pond-a1', amount: 2 }];
    const merged = mergeSubmittedRowsWithinScope('feedingRecords', state.feedingRecords, submitted, state, hallManager) as any[];
    expect(merged.map((row) => row.id).sort()).toEqual(['feed-a', 'feed-b']);
    expect(merged.find((row) => row.id === 'feed-a')?.amount).toBe(2);
  });

  it('rejects submitted rows that reference a pond outside the user scope', () => {
    const result = validateSubmittedUserScope(state, { feedingRecords: [{ id: 'evil', pondId: 'pond-b1' }] }, ['feedingRecords'], hallManager);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('STATE_SCOPE_VIOLATION:feedingRecords');
  });

  it('requires a scope for operational restricted roles and validates scope IDs', () => {
    expect(validateRequestedUserScope(state, 'Hall Manager', [], [])).toEqual({ ok: false, error: 'USER_OPERATIONAL_SCOPE_REQUIRED' });
    expect(validateRequestedUserScope(state, 'Technician', ['missing'], [])).toEqual({ ok: false, error: 'USER_HALL_SCOPE_INVALID' });
    expect(validateRequestedUserScope(state, 'Hall Manager', ['hall-a'], [])).toEqual({ ok: true, hallScope: ['hall-a'], pondScope: [] });
  });
});
