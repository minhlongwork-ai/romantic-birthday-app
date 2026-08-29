import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contentTypeMatches,
  validateBuildManifest,
  validateNotFoundDocument,
  validateRemoteBuild,
} from '../../scripts/validate-build.mjs';

const site = {
  origin: 'https://romantic-birthday-app.vercel.app',
  routes: {
    chooser: '/',
    birthday: '/birthday/',
    august: '/august/',
    september: '/september/',
  },
};

function validManifest() {
  return {
    buildSha: '0123456789ab',
    routes: [
      { id: 'chooser', path: '/', index: '/index.html' },
      { id: 'birthday', path: '/birthday/', index: '/birthday/index.html' },
      { id: 'august', path: '/august/', index: '/august/index.html' },
      { id: 'september', path: '/september/', index: '/september/index.html' },
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
      {
        route: 'september',
        url: '/september/assets/index-Abcdef12.js',
        sha256: 'd'.repeat(64),
        bytes: 384,
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

test('build manifest enforces the September initial-transfer budget', () => {
  const manifest = validManifest();
  const septemberEntry = manifest.assets.find(asset => asset.route === 'september');
  septemberEntry.bytes = 500 * 1024 + 1;

  const errors = validateBuildManifest(manifest, site).join('\n');
  assert.match(errors, /September initial transfer/i);
  assert.match(errors, /500 KB/i);
});

test('build manifest keeps September assets inside the September namespace', () => {
  const manifest = validManifest();
  const septemberEntry = manifest.assets.find(asset => asset.route === 'september');
  septemberEntry.url = '/assets/september-Abcdef12.js';

  const errors = validateBuildManifest(manifest, site).join('\n');
  assert.match(errors, /September namespace/i);
});

test('remote MIME validation accepts only the JavaScript compatibility alias', () => {
  assert.equal(contentTypeMatches('text/javascript', 'text/javascript; charset=utf-8'), true);
  assert.equal(contentTypeMatches('text/javascript', 'application/javascript; charset=utf-8'), true);
  assert.equal(contentTypeMatches('application/javascript', 'text/javascript'), true);
  assert.equal(contentTypeMatches('text/css', 'text/plain'), false);
  assert.equal(contentTypeMatches('image/webp', 'image/png'), false);
});

test('shared 404 document stays private from search and links back to the chooser', () => {
  assert.deepEqual(validateNotFoundDocument([
    '<meta name="robots" content="noindex">',
    '<a href="/">Quay về chọn thiệp</a>',
  ].join('')), []);

  const errors = validateNotFoundDocument('<p>%SITE_TITLE%</p>').join('\n');
  assert.match(errors, /noindex/i);
  assert.match(errors, /chooser/i);
  assert.match(errors, /metadata placeholder/i);
});

test('remote validation checks every direct route refresh and the shared 404 response', async () => {
  const manifest = validManifest();
  const requests = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method || 'GET';
    requests.push([method, url.pathname]);

    if (url.pathname === '/build-manifest.json') {
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    const asset = manifest.assets.find(candidate => candidate.url === url.pathname);
    if (asset) {
      return new Response(method === 'HEAD' ? null : 'asset', {
        status: 200,
        headers: { 'content-type': asset.contentType },
      });
    }

    const route = manifest.routes.find(candidate => candidate.path === url.pathname);
    if (route) {
      const canonical = new URL(route.path, site.origin).href;
      return new Response(`<link rel="canonical" href="${canonical}">`, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    if (url.pathname === '/__route_validation_missing__') {
      return new Response([
        '<meta name="robots" content="noindex">',
        '<a href="/">Quay về chọn thiệp</a>',
      ].join(''), {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    throw new Error(`Unexpected request: ${method} ${url.pathname}`);
  };

  const result = await validateRemoteBuild('https://preview.example.test', {
    fetchImpl,
    expectedBuildSha: manifest.buildSha,
  });
  assert.deepEqual(result.errors, []);
  for (const route of manifest.routes) {
    assert.ok(requests.some(([method, pathname]) =>
      method === 'GET' && pathname === route.path));
  }
  assert.ok(requests.some(([method, pathname]) =>
    method === 'GET' && pathname === '/__route_validation_missing__'));
});

test('remote validation rejects a deployment from the wrong commit', async () => {
  const manifest = validManifest();
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === '/build-manifest.json') {
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const asset = manifest.assets.find(candidate => candidate.url === url.pathname);
    if (asset) {
      return new Response(init.method === 'HEAD' ? null : 'asset', {
        status: 200,
        headers: { 'content-type': asset.contentType },
      });
    }
    const route = manifest.routes.find(candidate => candidate.path === url.pathname);
    if (route) {
      return new Response(`<link rel="canonical" href="${new URL(route.path, site.origin).href}">`, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    }
    return new Response([
      '<meta name="robots" content="noindex">',
      '<a href="/">Quay về chọn thiệp</a>',
    ].join(''), {
      status: 404,
      headers: { 'content-type': 'text/html' },
    });
  };

  const result = await validateRemoteBuild('https://preview.example.test', {
    fetchImpl,
    expectedBuildSha: 'fedcba987654',
  });
  assert.match(result.errors.join('\n'), /does not match expected fedcba987654/i);
});
