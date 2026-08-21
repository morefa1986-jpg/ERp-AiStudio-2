import { describe, expect, it } from 'vitest';
import { sha256 } from '../utils/sha256';

describe('backup SHA-256 checksum', () => {
  it('matches the standard empty-string and hello vectors', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});
