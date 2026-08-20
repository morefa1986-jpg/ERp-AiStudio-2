export const PASSWORD_SALT = 'fathi_aqua_salt_2026';

/**
 * Computes salted SHA-256 hash using Web Crypto API in browser / Node environments.
 */
export async function hashPasswordWithSalt(plain: string, salt: string = PASSWORD_SALT): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback Node.js crypto if running in test/script environment without global crypto.subtle
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(plain + salt).digest('hex');
  } catch {
    let hash = 0;
    const combined = plain + salt;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash << 5) - hash + combined.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  }
}

/**
 * Securely verifies password against expected hash without timing leaks.
 */
export async function verifyPasswordSecurely(
  candidatePlain: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const candidateHash = await hashPasswordWithSalt(candidatePlain, salt);
  if (candidateHash.length !== expectedHash.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < candidateHash.length; i++) {
    diff |= candidateHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}
