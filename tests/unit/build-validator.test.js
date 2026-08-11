import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contentTypeMatches,
  validateBuildManifest,
} from '../../scripts/validate-build.mjs';

const site = {
  origin: 'https://romantic-birthday-app.vercel.app',
  routes: { chooser: '/', birthday: '/birthday/', august: '/august/' },
};

function validManifest() {
  return {
    buildSha: '0123456789ab',
    routes: [
      { id: 'chooser', path: '/', index: '/index.html' },
      { id: 'birthday', path: '/birthday/', index: '/birthday/index.html' },
      { id: 'august', path: '/august/', index: '/august/index.html' },
    ],
    assets: [
      {
        route: 'chooser',
        url: '/assets/portal-Abcdef12.js',
        sha256: 'a'.repeat(64),
        bytes: 128,
        contentType: 'text/javascript',
        critical: true,
      },
      {
        route: 'birthday',
        url: '/birthday/assets/index-Abcdef12.css',
        sha256: 'b'.repeat(64),
        bytes: 256,
        contentType: 'text/css',
        critical: true,
      },
      {
        route: 'august',
        url: '/august/assets/index-Abcdef12.js',
        sha256: 'c'.repeat(64),
        bytes: 512,
        contentType: 'text/javascript',
        critical: true,
      },
    ],
    externalRuntimeUrls: [],
  };
}

test('build manifest contract accepts clean canonical route assets', () => {
  assert.deepEqual(validateBuildManifest(validManifest(), site), []);
});

test('build manifest contract rejects external, unhashed, or forbidden runtime assets', () => {
  const manifest = validManifest();
  manifest.externalRuntimeUrls.push('https://cdn.example.com/runtime.js');
  manifest.assets.push(
    {
      route: 'birthday',
      url: '/birthday/assets/index.js',
      sha256: 'd'.repeat(64),
      bytes: 1,
      contentType: 'text/javascript',
      critical: false,
    },
    {
      route: 'birthday',
      url: '/birthday/vendor/mediapipe/hands/hand_landmark_full.tflite',
      sha256: 'e'.repeat(64),
      bytes: 1,
      contentType: 'application/octet-stream',
      critical: false,
    },
    {
      route: 'august',
      url: 'https://images.example.com/flower.webp',
      sha256: 'f'.repeat(64),
      bytes: 1,
      contentType: 'image/webp',
      critical: false,
    },
  );

  const errors = validateBuildManifest(manifest, site).join('\n');
  assert.match(errors, /external runtime URL/i);
  assert.match(errors, /hashed filename/i);
  assert.match(errors, /full MediaPipe model/i);
  assert.match(errors, /same-origin path/i);
});

test('remote MIME validation accepts only the JavaScript compatibility alias', () => {
  assert.equal(contentTypeMatches('text/javascript', 'text/javascript; charset=utf-8'), true);
  assert.equal(contentTypeMatches('text/javascript', 'application/javascript; charset=utf-8'), true);
  assert.equal(contentTypeMatches('application/javascript', 'text/javascript'), true);
  assert.equal(contentTypeMatches('text/css', 'text/plain'), false);
  assert.equal(contentTypeMatches('image/webp', 'image/png'), false);
});
