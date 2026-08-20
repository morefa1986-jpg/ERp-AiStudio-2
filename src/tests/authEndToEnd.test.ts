import { describe, expect, it } from 'vitest';
import { PASSWORD_SALT, hashPasswordWithSalt, verifyPasswordSecurely } from '../utils/authSecurity';
import { roleAllows } from '../utils/rbac';

describe('Auth security and RBAC production policy', () => {
  it('generates consistent SHA-256 hashes for the configured compatibility salt', async () => {
    const hash1 = await hashPasswordWithSalt('admin123', PASSWORD_SALT);
    const hash2 = await hashPasswordWithSalt('admin123', PASSWORD_SALT);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('rejects incorrect passwords and accepts the correct password', async () => {
    const expectedHash = await hashPasswordWithSalt('valid-password', PASSWORD_SALT);
    await expect(verifyPasswordSecurely('wrong-password', PASSWORD_SALT, expectedHash)).resolves.toBe(false);
    await expect(verifyPasswordSecurely('valid-password', PASSWORD_SALT, expectedHash)).resolves.toBe(true);
  });

  it('rejects malformed stored hashes', async () => {
    await expect(verifyPasswordSecurely('anything', PASSWORD_SALT, 'weak-hash')).resolves.toBe(false);
  });

  it('is fail-closed for unknown roles', () => {
    expect(roleAllows('GUEST_UNKNOWN', 'dashboard', 'view')).toBe(false);
    expect(roleAllows('', 'feeding', 'create')).toBe(false);
  });

  it('grants expected role access without granting destructive access broadly', () => {
    expect(roleAllows('Super Admin', 'users', 'manage')).toBe(true);
    expect(roleAllows('Veterinarian', 'treatments', 'create')).toBe(true);
    expect(roleAllows('Veterinarian', 'accounting', 'view')).toBe(false);
    expect(roleAllows('Farm Manager', 'ponds', 'edit')).toBe(true);
    expect(roleAllows('Farm Manager', 'ponds', 'delete')).toBe(false);
    expect(roleAllows('Viewer/Auditor', 'accounting', 'view')).toBe(true);
    expect(roleAllows('Viewer/Auditor', 'accounting', 'edit')).toBe(false);
  });
});
