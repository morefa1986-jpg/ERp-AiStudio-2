import { describe, expect, it } from 'vitest';
import { hashPasswordServer, verifyPasswordServer } from '../../server/auth';
import { roleAllows } from '../utils/rbac';

describe('Enterprise authentication security', () => {
  it('uses salted scrypt without exposing plaintext credentials', () => {
    const expected = hashPasswordServer('a-secure-password');
    expect(expected).toMatch(/^scrypt\$/);
    expect(expected).not.toContain('a-secure-password');
    expect(verifyPasswordServer('a-secure-password', expected)).toBe(true);
  });

  it('rejects wrong credentials and malformed stored hashes', () => {
    const expected = hashPasswordServer('correct-password');
    expect(verifyPasswordServer('wrong-password', expected)).toBe(false);
    expect(verifyPasswordServer('correct-password', 'not-a-valid-hash')).toBe(false);
  });

  it('applies fail-closed production RBAC', () => {
    expect(roleAllows('Super Admin', 'users', 'manage')).toBe(true);
    expect(roleAllows('Veterinarian', 'treatments', 'edit')).toBe(true);
    expect(roleAllows('Veterinarian', 'accounting', 'view')).toBe(false);
    expect(roleAllows('UNKNOWN_ROLE', 'dashboard', 'view')).toBe(false);
  });
});
