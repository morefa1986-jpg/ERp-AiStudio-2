import { describe, expect, it } from 'vitest';
import { constantTimeEqual, isSessionExpired, resolveSessionPolicy } from '../../server/sessionPolicy';

describe('server session policy', () => {
  it('uses a four-hour absolute TTL and twenty-minute inactivity timeout by default', () => {
    const policy = resolveSessionPolicy({});
    expect(policy.absoluteTtlMs).toBe(240 * 60_000);
    expect(policy.inactivityTtlMs).toBe(20 * 60_000);
    expect(policy.bootstrapWindowMs).toBe(15 * 60_000);
    expect(policy.bootstrapMaxFailures).toBe(5);
  });

  it('expires inactive and absolute-expired sessions but permits recent activity', () => {
    const policy = resolveSessionPolicy({});
    const now = 1_000_000_000;
    expect(isSessionExpired({ createdAt: now - 60_000, lastActivityAt: now - 60_000, expiresAt: now + 60_000 }, policy, now)).toBe(false);
    expect(isSessionExpired({ createdAt: now - 30 * 60_000, lastActivityAt: now - 20 * 60_000, expiresAt: now + 60_000 }, policy, now)).toBe(true);
    expect(isSessionExpired({ createdAt: now - 240 * 60_000, lastActivityAt: now - 1_000, expiresAt: now }, policy, now)).toBe(true);
  });

  it('bounds unsafe environment overrides and compares setup tokens without prefix matching', () => {
    const policy = resolveSessionPolicy({
      FATHI_SESSION_ABSOLUTE_MINUTES: '100000',
      FATHI_SESSION_INACTIVITY_MINUTES: '1',
      FATHI_BOOTSTRAP_MAX_FAILURES: '999',
    });
    expect(policy.absoluteTtlMs).toBe(240 * 60_000);
    expect(policy.inactivityTtlMs).toBe(20 * 60_000);
    expect(policy.bootstrapMaxFailures).toBe(5);
    expect(constantTimeEqual('setup-token-123', 'setup-token-123')).toBe(true);
    expect(constantTimeEqual('setup-token', 'setup-token-123')).toBe(false);
    expect(constantTimeEqual(undefined, 'setup-token-123')).toBe(false);
  });
});
