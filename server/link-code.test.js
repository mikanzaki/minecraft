import assert from 'node:assert/strict';
import test from 'node:test';
import { newLinkCode, normalizeLinkCode, normalizeShortCode } from './link-code.js';

test('generated codes are 16 unambiguous base32 characters', () => {
  const code = newLinkCode();
  assert.equal(code.length, 16);
  assert.match(code, /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{16}$/);
});

test('manual codes accept lowercase, spaces, and group hyphens', () => {
  assert.equal(normalizeShortCode('0123-4567-89ab-cdef'), '0123456789ABCDEF');
  assert.equal(normalizeShortCode('0123 4567 89AB CDEF'), '0123456789ABCDEF');
});

test('manual codes reject ambiguous or malformed characters', () => {
  assert.equal(normalizeShortCode('0123-4567-89AB-CDEO'), null);
  assert.equal(normalizeShortCode('0123-4567-89AB-CDE'), null);
});

test('legacy opaque URL tokens remain accepted without case changes', () => {
  const legacyCode = 'zm8CM6vEfBeZKpyjqG0oywz8okNlelwE71210ezhQBY';
  assert.equal(normalizeLinkCode(legacyCode), legacyCode);
});
