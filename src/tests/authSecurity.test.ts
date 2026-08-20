import { describe, expect, it } from 'vitest';
import { PASSWORD_SALT, hashPasswordWithSalt, verifyPasswordSecurely } from '../utils/authSecurity';
import { roleAllows } from '../utils/rbac';

describe('Enterprise authentication security', () => {
  it('uses deterministic salted SHA-256 without exposing plaintext credentials', async () => {
    const expected = await hashPasswordWithSalt('admin123', PASSWORD_SALT);
    expect(expected).toHaveLength(64);
    expect(expected).not.toContain('admin123');
    await expect(verifyPasswordSecurely('admin123', PASSWORD_SALT, expected)).resolves.toBe(true);
  });

  it('rejects wrong credentials and malformed stored hashes', async () => {
    const expected = await hashPasswordWithSalt('correct-password', PASSWORD_SALT);
    await expect(verifyPasswordSecurely('wrong-password', PASSWORD_SALT, expected)).resolves.toBe(false);
    await expect(verifyPasswordSecurely('correct-password', PASSWORD_SALT, 'not-a-valid-hash')).resolves.toBe(false);
  });

  it('applies fail-closed production RBAC', () => {
    expect(roleAllows('Super Admin', 'users', 'manage')).toBe(true);
    expect(roleAllows('Veterinarian', 'treatments', 'edit')).toBe(true);
    expect(roleAllows('Veterinarian', 'accounting', 'view')).toBe(false);
    expect(roleAllows('UNKNOWN_ROLE', 'dashboard', 'view')).toBe(false);
  });
});
