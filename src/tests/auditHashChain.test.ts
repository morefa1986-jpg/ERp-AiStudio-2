import { describe, expect, it } from 'vitest';
import { buildAuditHashChain, verifyAuditHashChain } from '../../server/auditHashChain';

const row = (id: string, afterState = '{}') => ({
  id,
  timestamp: `2026-08-24T10:00:0${id.slice(-1)}Z`,
  userId: 'user_1',
  userRole: 'Farm Manager',
  action: 'create',
  entity: 'TestEntity',
  entityId: id,
  afterState,
  transactionId: `tx_${id}`,
});

describe('audit hash chain', () => {
  it('verifies intact chains and detects tampering or row removal', () => {
    const chain = buildAuditHashChain([row('a1'), row('a2'), row('a3')]);
    expect(verifyAuditHashChain(chain).ok).toBe(true);

    const tampered = chain.map((entry) => ({ ...entry }));
    tampered[1].afterState = '{"changed":true}';
    expect(verifyAuditHashChain(tampered).error).toBe('AUDIT_HASH_MISMATCH');

    const removed = [chain[0], chain[2]];
    expect(verifyAuditHashChain(removed).error).toBe('AUDIT_PREVIOUS_HASH_MISMATCH');
  });
});
