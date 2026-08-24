import { describe, expect, it } from 'vitest';
import { fallbackDurableOperation, inferDurableOperation } from '../utils/durableOutbox';
import { STATE_COLLECTIONS } from '../utils/stateIntegrity';

function state(): Record<string, unknown> {
  return Object.fromEntries(STATE_COLLECTIONS.map((key) => [key, []]));
}

describe('durable offline outbox operation inference', () => {
  it('maps a feeding state transition to the feeding module', () => {
    const previous = state();
    const next = {
      ...previous,
      ponds: [{ id: 'pond-1' }],
      feedingRecords: [{ id: 'feed-1' }],
      inventory: [{ id: 'inv-1' }],
      inventoryTxs: [{ id: 'tx-1' }],
    };
    expect(inferDurableOperation(previous, next)).toMatchObject({ module: 'feeding', action: 'edit' });
  });

  it('maps authoritative water telemetry changes to water_quality', () => {
    const previous = state();
    const next = {
      ...previous,
      ponds: [{ id: 'pond-1' }],
      waterLogs: [{ id: 'water-1' }],
    };
    expect(inferDurableOperation(previous, next)).toMatchObject({ module: 'water_quality', action: 'edit' });
  });

  it('maps accounting ledger changes to accounting', () => {
    const previous = state();
    const next = {
      ...previous,
      accounts: [{ id: 'acc-1' }],
      journals: [{ id: 'journal-1' }],
    };
    expect(inferDurableOperation(previous, next)).toMatchObject({ module: 'accounting', action: 'edit' });
  });

  it('fails closed when one snapshot combines unrelated modules', () => {
    const previous = state();
    const next = {
      ...previous,
      waterLogs: [{ id: 'water-1' }],
      journals: [{ id: 'journal-1' }],
    };
    expect(inferDurableOperation(previous, next)).toBeNull();
    expect(fallbackDurableOperation()).toMatchObject({ module: 'settings' });
  });
});
