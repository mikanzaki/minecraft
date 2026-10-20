import { randomInt } from 'node:crypto';

const SHORT_CODE_PATTERN = /^\d{6}$/;
const PREVIOUS_SHORT_CODE_PATTERN = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{16}$/;
const LEGACY_CODE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export function newLinkCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function normalizeShortCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().replace(/[\s-]/g, '');
  return SHORT_CODE_PATTERN.test(code) ? code : null;
}

export function normalizeLinkCode(value) {
  const shortCode = normalizeShortCode(value);
  if (shortCode) return shortCode;
  if (typeof value !== 'string') return null;

  const legacyCode = value.trim();
  if (PREVIOUS_SHORT_CODE_PATTERN.test(legacyCode)) return legacyCode;
  return LEGACY_CODE_PATTERN.test(legacyCode) ? legacyCode : null;
}
