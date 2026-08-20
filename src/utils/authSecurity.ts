export const PASSWORD_SALT = 'fathi_aqua_salt_2026';

/**
 * Computes a deterministic salted SHA-256 hash for compatibility with the
 * current offline credential store. If a cryptographic implementation is not
 * available, authentication fails closed instead of falling back to a weak hash.
 */
export async function hashPasswordWithSalt(plain: string, salt: string = PASSWORD_SALT): Promise<string> {
  if (typeof plain !== 'string' || typeof salt !== 'string') throw new Error('INVALID_PASSWORD_INPUT');

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(plain + salt).digest('hex');
  } catch {
    throw new Error('CRYPTO_UNAVAILABLE');
  }
}

/**
 * Constant-work comparison for equal-length hex hashes.
 */
export async function verifyPasswordSecurely(
  candidatePlain: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const candidateHash = await hashPasswordWithSalt(candidatePlain, salt);
  if (candidateHash.length !== expectedHash.length) return false;

  let diff = 0;
  for (let index = 0; index < candidateHash.length; index++) {
    diff |= candidateHash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return diff === 0;
}
