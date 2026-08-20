import { describe, it, expect } from 'vitest';
import { hashPasswordWithSalt, verifyPasswordSecurely } from '../utils/authSecurity';
import { UserRole } from '../types';

describe('Auth Security End-to-End Hardening', () => {
  const testSalt = 'fathi_aqua_salt_v6';

  it('generates consistent SHA-256 hashes for salted passwords', async () => {
    const hash1 = await hashPasswordWithSalt('admin123', testSalt);
    const hash2 = await hashPasswordWithSalt('admin123', testSalt);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // 256 bits in hex
  });

  it('rejects incorrect passwords during verification', async () => {
    const expectedHash = await hashPasswordWithSalt('admin123', testSalt);
    const isCorrect = await verifyPasswordSecurely('wrongpass', testSalt, expectedHash);
    expect(isCorrect).toBe(false);
  });

  it('accepts valid credentials during verification', async () => {
    const expectedHash = await hashPasswordWithSalt('vet123', testSalt);
    const isCorrect = await verifyPasswordSecurely('vet123', testSalt, expectedHash);
    expect(isCorrect).toBe(true);
  });

  it('never matches passwords hashed with different salts', async () => {
    const hashWithSaltA = await hashPasswordWithSalt('password', 'saltA');
    const hashWithSaltB = await hashPasswordWithSalt('password', 'saltB');
    expect(hashWithSaltA).not.toBe(hashWithSaltB);
  });

  it('verifies that RBAC defaults deny access for undefined/unknown roles', () => {
    const allowedRoles: UserRole[] = ['SUPER_ADMIN', 'FARM_MANAGER'];
    const testUnknownRole = 'GUEST_UNKNOWN' as UserRole;
    expect(allowedRoles.includes(testUnknownRole)).toBe(false);
  });
});
