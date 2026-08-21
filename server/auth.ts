import crypto from 'crypto';

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_BYTES = 64;

export function hashPasswordServer(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, SCRYPT_KEY_BYTES, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString('hex');
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived}`;
}

export function verifyPasswordServer(plain: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nText, rText, pText, salt, expectedHex] = parts;
  if (!/^\d+$/.test(nText) || !/^\d+$/.test(rText) || !/^\d+$/.test(pText) || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false;
  const n = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  if (n < 16_384 || r < 1 || r > 32 || p < 1 || p > 16 || n > 1_048_576) return false;
  try {
    const actual = crypto.scryptSync(plain, salt, SCRYPT_KEY_BYTES, { N: n, r, p });
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export const DUMMY_PASSWORD_HASH = hashPasswordServer('fathi-dummy-password-never-valid');
