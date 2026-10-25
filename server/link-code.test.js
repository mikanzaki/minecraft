import assert from 'node:assert/strict';
import test from 'node:test';
import { newLinkCode, normalizeLinkCode, normalizeShortCode } from './link-code.js';

test('generated codes are four decimal digits', () => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    assert.match(newLinkCode(), /^\d{4}$/);
  }
});

test('manual codes accept spaces and hyphens while preserving leading zeroes', () => {
  assert.equal(normalizeShortCode('00 12'), '0012');
  assert.equal(normalizeShortCode('00-12'), '0012');
  assert.equal(normalizeShortCode(' 0123 '), '0123');
});

test('manual codes reject non-numeric or malformed values', () => {
  assert.equal(normalizeShortCode('12A4'), null);
  assert.equal(normalizeShortCode('123'), null);
  assert.equal(normalizeShortCode('12345'), null);
  assert.equal(normalizeShortCode(null), null);
});

test('codes issued by the previous six-digit version remain accepted until expiry', () => {
  assert.equal(normalizeLinkCode('012345'), '012345');
});

test('codes issued by the previous alphanumeric version remain accepted until expiry', () => {
  const previousCode = '0123456789ABCDEF';
  assert.equal(normalizeLinkCode(previousCode), previousCode);
});

test('legacy opaque URL tokens remain accepted without case changes', () => {
  const legacyCode = 'zm8CM6vEfBeZKpyjqG0oywz8okNlelwE71210ezhQBY';
  assert.equal(normalizeLinkCode(legacyCode), legacyCode);
});
