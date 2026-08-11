import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeRuntimeMessage,
  runtimeErrorFingerprint,
} from '../../scripts/runtime-fingerprint.mjs';

test('runtime fingerprint normalization removes volatile IDs, URLs, and numbers', () => {
  assert.equal(
    normalizeRuntimeMessage(
      'Request 8472 failed at https://romantic-birthday-app.vercel.app/birthday/?to=Em id 550e8400-e29b-41d4-a716-446655440000',
    ),
    'request <n> failed at <url> id <uuid>',
  );
});

test('runtime fingerprint sorts and deduplicates affected routes', () => {
  assert.equal(
    runtimeErrorFingerprint({
      errorName: 'TypeError',
      message: 'Request 8472 failed',
      affectedRoutes: ['/birthday/', '/', '/birthday/'],
    }),
    'typeerror | request <n> failed | /,/birthday/',
  );
});
