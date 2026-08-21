import { describe, expect, it } from 'vitest';
import { hashPasswordServer, verifyPasswordServer } from '../../server/auth';
import { roleAllows } from '../utils/rbac';

describe('Auth security and RBAC production policy', () => {
  it('uses salted scrypt hashes with independent salts', () => {
    const hash1 = hashPasswordServer('a-strong-password');
    const hash2 = hashPasswordServer('a-strong-password');
    expect(hash1).not.toBe(hash2);
    expect(hash1).toMatch(/^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(hash1).not.toContain('a-strong-password');
    expect(verifyPasswordServer('a-strong-password', hash1)).toBe(true);
  });

  it('rejects incorrect passwords and accepts the correct password', () => {
    const expectedHash = hashPasswordServer('valid-password');
    expect(verifyPasswordServer('wrong-password', expectedHash)).toBe(false);
    expect(verifyPasswordServer('valid-password', expectedHash)).toBe(true);
  });

  it('rejects malformed stored hashes', () => {
    expect(verifyPasswordServer('anything', 'weak-hash')).toBe(false);
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
