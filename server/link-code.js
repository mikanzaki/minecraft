import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SHORT_CODE_PATTERN = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{16}$/;
const LEGACY_CODE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export function newLinkCode() {
  // Ten random bytes provide 80 bits; Crockford-style characters avoid ambiguous I, L, O, and U.
  const bytes = randomBytes(10);
  let buffer = 0;
  let bits = 0;
  let code = '';

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      code += ALPHABET[(buffer >>> bits) & 31];
    }
    buffer &= (1 << bits) - 1;
  }

  return code;
}

export function normalizeShortCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase().replace(/[\s-]/g, '');
  return SHORT_CODE_PATTERN.test(code) ? code : null;
}

export function normalizeLinkCode(value) {
  const shortCode = normalizeShortCode(value);
  if (shortCode) return shortCode;
  if (typeof value !== 'string') return null;

  const legacyCode = value.trim();
  return LEGACY_CODE_PATTERN.test(legacyCode) ? legacyCode : null;
}
