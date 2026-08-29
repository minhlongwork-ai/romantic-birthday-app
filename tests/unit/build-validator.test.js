import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contentTypeMatches,
  validateBuildManifest,
  validateNotFoundDocument,
  validateRemoteBuild,
} from '../../scripts/validate-build.mjs';
import { analyzeRuntimeArtifacts } from '../../scripts/runtime-dependencies.mjs';

const site = {
  origin: 'https://romantic-birthday-app.vercel.app',
  routes: {
    chooser: '/',
    birthday: '/birthday/',
    august: '/august/',
    september: '/september/',
  },
  experiences: [
    {
      id: 'birthday',
      year: 2026,
      month: 5,
      route: '/birthday/',
      status: 'published',
      preview: { publicPath: '/experience-previews/birthday.webp' },
    },
    {
      id: 'august',
      year: 2026,
      month: 8,
      route: '/august/',
      status: 'published',
      preview: { publicPath: '/experience-previews/august.webp' },
    },
    {
      id: 'september',
      year: 2026,
      month: 9,
      route: '/september/',
      status: 'draft',
      preview: { publicPath: '/experience-previews/september.webp' },
    },
  ],
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
    catalog: [
      {
        id: 'birthday',
        year: 2026,
        month: 5,
        route: '/birthday/',
        built: true,
        previewPublicPath: '/experience-previews/birthday.webp',
      },
      {
        id: 'august',
        year: 2026,
        month: 8,
        route: '/august/',
        built: true,
        previewPublicPath: '/experience-previews/august.webp',
      },
      {
        id: 'september',
        year: 2026,
        month: 9,
        route: '/september/',
        built: true,
        previewPublicPath: '/experience-previews/september.webp',
      },
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
      ...['birthday', 'august', 'september'].map((id, index) => ({
        route: 'chooser',
        url: `/experience-previews/${id}.webp`,
        sha256: String(index + 5).repeat(64),
        bytes: 1024,
        contentType: 'image/webp',
        critical: false,
      })),
    ],
    initialAssetUrlsByRoute: {
      chooser: ['/assets/portal-Abcdef12.js'],
      birthday: ['/birthday/assets/index-Abcdef12.css'],
      august: ['/august/assets/index-Abcdef12.js'],
      september: ['/september/assets/index-Abcdef12.js'],
    },
    externalRuntimeUrls: [],
  };
}

function validProductionManifest() {
  const manifest = validManifest();
  manifest.routes = manifest.routes.filter(({ id }) => id !== 'september');
  manifest.catalog.find(({ id }) => id === 'september').built = false;
  manifest.assets = manifest.assets.filter(({ route, url }) =>
    route !== 'september' && !url.startsWith('/september/'));
  delete manifest.initialAssetUrlsByRoute.september;
  return manifest;
}

test('built-artifact analysis derives the September initial dependency closure', () => {
  const artifacts = [
    {
      url: '/september/index.html',
      contentType: 'text/html',
      source: [
        '<link rel="stylesheet" href="./assets/index-Abcdef12.css">',
        '<script type="module" src="./assets/index-Abcdef12.js"></script>',
        '<meta property="og:image" content="/september/images/preview.webp">',
      ].join(''),
    },
    {
      url: '/september/assets/index-Abcdef12.css',
      contentType: 'text/css',
      source: [
        '@font-face{src:url(./font-Abcdef12.woff2) format("woff2"),url(./font-Abcdef12.woff) format("woff")}',
        'body{background:url(/september/images/background-desktop.jpg)}',
        '@media(max-width:900px){body{background:url(/september/images/background-mobile.jpg)}}',
      ].join(''),
    },
    {
      url: '/september/assets/index-Abcdef12.js',
      contentType: 'text/javascript',
      source: 'console.log("ready");formatter.from"),";',
    },
    { url: '/september/assets/font-Abcdef12.woff2', contentType: 'font/woff2' },
    { url: '/september/assets/font-Abcdef12.woff', contentType: 'font/woff' },
    { url: '/september/images/background-desktop.jpg', contentType: 'image/jpeg' },
    { url: '/september/images/background-mobile.jpg', contentType: 'image/jpeg' },
    { url: '/september/images/preview.webp', contentType: 'image/webp' },
  ];

  const result = analyzeRuntimeArtifacts({
    artifacts,
    routes: validManifest().routes.filter(({ id }) => id === 'september'),
    siteOrigin: site.origin,
  });

  assert.deepEqual(result.externalRuntimeUrls, []);
  assert.deepEqual(result.missingRuntimeUrls, []);
  assert.deepEqual(result.initialAssetUrlsByRoute.september, [
    '/september/assets/font-Abcdef12.woff2',
    '/september/assets/index-Abcdef12.css',
    '/september/assets/index-Abcdef12.js',
    '/september/images/background-desktop.jpg',
    '/september/index.html',
  ]);
  assert.equal(
    result.initialAssetUrlsByRoute.september.includes('/september/images/preview.webp'),
    false,
  );
});

test('built-artifact analysis detects injected third-party HTML, CSS, and JS URLs', () => {
  const artifacts = [
    {
      url: '/september/index.html',
      contentType: 'text/html',
      source: '<script src="https://cdn.example.test/runtime.js"></script>',
    },
    {
      url: '/september/assets/index-Abcdef12.css',
      contentType: 'text/css',
      source: '@media(max-width:1px){body{background:url(https://images.example.test/pixel.png)}}',
    },
    {
      url: '/september/assets/index-Abcdef12.js',
      contentType: 'text/javascript',
      source: 'fetch("https://analytics.example.test/event")',
    },
  ];

  const result = analyzeRuntimeArtifacts({
    artifacts,
    routes: validManifest().routes.filter(({ id }) => id === 'september'),
    siteOrigin: site.origin,
  });

  assert.deepEqual(result.externalRuntimeUrls, [
    'https://analytics.example.test/event',
    'https://cdn.example.test/runtime.js',
    'https://images.example.test/pixel.png',
  ]);
});

test('build manifest contract accepts clean canonical route assets', () => {
  assert.deepEqual(validateBuildManifest(validManifest(), site), []);
});

test('production manifest accepts a non-built draft while retaining its chooser preview', () => {
  assert.deepEqual(
    validateBuildManifest(validProductionManifest(), site, { environment: 'production' }),
    [],
  );
});

test('production manifest rejects a draft that claims it was built', () => {
  const errors = validateBuildManifest(validManifest(), site, {
    environment: 'production',
  }).join('\n');

  assert.match(errors, /draft experience september cannot be built in production/i);
});

test('build manifest rejects a runtime namespace for a non-built draft', () => {
  const manifest = validProductionManifest();
  manifest.assets.push({
    route: 'september',
    url: '/september/assets/index-Abcdef12.js',
    sha256: 'f'.repeat(64),
    bytes: 1,
    contentType: 'text/javascript',
    critical: false,
  });

  assert.match(
    validateBuildManifest(manifest, site).join('\n'),
    /non-built experience september|September namespace/i,
  );
});

test('build manifest rejects unregistered routes and personalized fields', () => {
  const manifest = validProductionManifest();
  manifest.routes.push({ id: 'october', path: '/october/', index: '/october/index.html' });
  manifest.recipient = 'Private recipient';
  manifest.catalog[0].query = '?to=Private';

  const errors = validateBuildManifest(manifest, site).join('\n');
  assert.match(errors, /unregistered|routes do not match/i);
  assert.match(errors, /recipient/i);
  assert.match(errors, /query/i);
});

test('build manifest rejects forwarded to and from query fields at any depth', () => {
  const manifest = validProductionManifest();
  manifest.catalog[0].to = 'Private recipient';
  manifest.assets[0].metadata = { from: 'Private sender' };

  const errors = validateBuildManifest(manifest, site, {
    environment: 'production',
  }).join('\n');
  assert.match(errors, /manifest\.catalog\[0\]\.to/i);
  assert.match(errors, /manifest\.assets\[0\]\.metadata\.from/i);
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

test('build manifest requires September critical flags to match its dependency closure', () => {
  const manifest = validManifest();
  manifest.assets.find(asset => asset.route === 'september').critical = false;
  manifest.initialAssetUrlsByRoute.september.push('/september/images/preview.webp');

  const errors = validateBuildManifest(manifest, site).join('\n');
  assert.match(errors, /September initial dependency closure/i);
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

test('remote production validation requires every non-built draft route to serve shared 404', async () => {
  const manifest = validProductionManifest();
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
      return new Response(
        `<link rel="canonical" href="${new URL(route.path, site.origin).href}">`,
        { status: 200, headers: { 'content-type': 'text/html' } },
      );
    }
    if (url.pathname === '/september/') {
      return new Response('<h1>Leaked draft</h1>', {
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

  const result = await validateRemoteBuild('https://production.example.test', {
    fetchImpl,
    environment: 'production',
  });
  assert.ok(requests.some(([method, pathname]) =>
    method === 'GET' && pathname === '/september/'));
  assert.match(result.errors.join('\n'), /Draft route \/september\/ returned 200; expected 404/i);
});
