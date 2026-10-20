import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectSiteSource } from './origin-policy.js';

const allowed = new Set(['https://discord.yydassai.f5.si']);

test('accepts the exact configured Origin', () => {
  assert.deepEqual(
    inspectSiteSource('https://discord.yydassai.f5.si', '', allowed),
    { allowed: true, source: 'origin' },
  );
});

test('accepts an origin-only Referer when Origin is absent', () => {
  assert.deepEqual(
    inspectSiteSource('', 'https://discord.yydassai.f5.si/', allowed),
    { allowed: true, source: 'referer' },
  );
});

test('uses an allowed Referer fallback without logging or trusting the mismatched value', () => {
  assert.deepEqual(
    inspectSiteSource('https://other.example', 'https://discord.yydassai.f5.si/login.html', allowed),
    { allowed: true, source: 'referer' },
  );
});

test('rejects unknown, malformed, credentialed, and missing origins', () => {
  assert.deepEqual(inspectSiteSource('https://other.example', '', allowed), {
    allowed: false,
    reason: 'origin_mismatch',
  });
  assert.deepEqual(inspectSiteSource('not a url', '', allowed), {
    allowed: false,
    reason: 'origin_mismatch',
  });
  assert.deepEqual(inspectSiteSource('https://user@discord.yydassai.f5.si', '', allowed), {
    allowed: false,
    reason: 'origin_mismatch',
  });
  assert.deepEqual(inspectSiteSource('', '', allowed), {
    allowed: false,
    reason: 'origin_missing',
  });
});
