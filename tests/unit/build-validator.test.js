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
  pages: {
    chooser: { ogImage: '/experience-previews/birthday.webp' },
    birthday: { ogImage: '/birthday/og-preview.jpg' },
    august: { ogImage: '/birthday/og-preview.jpg' },
    september: { ogImage: '/september/images/preview.webp' },
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
      {
        route: 'birthday',
        url: '/birthday/og-preview.jpg',
        sha256: 'e'.repeat(64),
        bytes: 2048,
        contentType: 'image/jpeg',
        critical: false,
      },
      {
        route: 'september',
        url: '/september/images/preview.webp',
        sha256: 'f'.repeat(64),
        bytes: 2048,
        contentType: 'image/webp',
        critical: false,
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
    lazyAssetUrlsByRoute: {
      chooser: [],
      birthday: [],
      august: [],
      september: [],
    },
    runtimeProfilesByRoute: {
      september: { workshop: [], camera: [] },
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
  delete manifest.lazyAssetUrlsByRoute.september;
  delete manifest.runtimeProfilesByRoute.september;
  return manifest;
}

function validManifestWithBirthdayAndSeptemberMediaPipe() {
  const manifest = validManifest();
  const mediaAsset = (route, url, bytes, contentType) => ({
    route,
    url,
    sha256: url.includes('birthday') ? '1'.repeat(64) : '2'.repeat(64),
    bytes,
    contentType,
    critical: false,
  });
  manifest.assets.push(
    mediaAsset('birthday', '/birthday/vendor/mediapipe/hands/hands_solution_wasm_bin.wasm', 9 * 1024 * 1024, 'application/wasm'),
    mediaAsset('birthday', '/birthday/vendor/mediapipe/hands/hands_solution_simd_wasm_bin.wasm', 9 * 1024 * 1024, 'application/wasm'),
    mediaAsset('september', '/september/assets/september-camera-Abcdef12.js', 512, 'text/javascript'),
    mediaAsset('september', '/september/assets/hand-landmarker.worker-Bbcdef12.js', 512, 'text/javascript'),
    mediaAsset('september', '/september/models/hand-landmarker-float16-v1.task', 8 * 1024 * 1024, 'application/octet-stream'),
    mediaAsset('september', '/september/vendor/mediapipe/vision_bundle.mjs', 256 * 1024, 'text/javascript'),
    mediaAsset('september', '/september/vendor/mediapipe/vision_wasm_internal.js', 512 * 1024, 'text/javascript'),
    mediaAsset('september', '/september/vendor/mediapipe/vision_wasm_internal.wasm', 12 * 1024 * 1024, 'application/wasm'),
  );
  manifest.lazyAssetUrlsByRoute.september = [
    '/september/assets/hand-landmarker.worker-Bbcdef12.js',
    '/september/assets/september-camera-Abcdef12.js',
  ];
  manifest.runtimeProfilesByRoute.september.camera = [
    '/september/assets/hand-landmarker.worker-Bbcdef12.js',
    '/september/assets/september-camera-Abcdef12.js',
    '/september/models/hand-landmarker-float16-v1.task',
    '/september/vendor/mediapipe/vision_bundle.mjs',
    '/september/vendor/mediapipe/vision_wasm_internal.js',
    '/september/vendor/mediapipe/vision_wasm_internal.wasm',
  ];
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

test('dynamic workshop and camera imports stay out of the September initial closure', () => {
  const artifacts = [
    {
      url: '/september/index.html',
      contentType: 'text/html',
      source: '<script type="module" src="./assets/index-Abcdef12.js"></script>',
    },
    {
      url: '/september/assets/index-Abcdef12.js',
      contentType: 'text/javascript',
      source: [
        'import("./september-workshop-A.js");',
        'import("./september-camera-A.js");',
      ].join('\n'),
    },
    {
      url: '/september/assets/september-workshop-A.js',
      contentType: 'text/javascript',
      source: 'export const workshop = true;',
    },
    {
      url: '/september/assets/september-camera-A.js',
      contentType: 'text/javascript',
      source: 'new Worker(new URL("./hand-landmarker.worker-B.js", import.meta.url), { type: "module" });',
    },
    {
      url: '/september/assets/hand-landmarker.worker-B.js',
      contentType: 'text/javascript',
      source: 'export const worker = true;',
    },
    { url: '/september/models/hand-landmarker-float16-v1.task', contentType: 'application/octet-stream' },
    { url: '/september/vendor/mediapipe/vision_bundle.mjs', contentType: 'text/javascript' },
    { url: '/september/vendor/mediapipe/vision_wasm_internal.js', contentType: 'text/javascript' },
    { url: '/september/vendor/mediapipe/vision_wasm_internal.wasm', contentType: 'application/wasm' },
  ];

  const result = analyzeRuntimeArtifacts({
    artifacts,
    routes: validManifest().routes.filter(({ id }) => id === 'september'),
    siteOrigin: site.origin,
  });

  assert.equal(
    result.initialAssetUrlsByRoute.september.includes('/september/assets/september-camera-A.js'),
    false,
  );
  assert.deepEqual(result.lazyAssetUrlsByRoute.september, [
    '/september/assets/hand-landmarker.worker-B.js',
    '/september/assets/september-camera-A.js',
    '/september/assets/september-workshop-A.js',
  ]);
  assert.deepEqual(result.runtimeProfilesByRoute.september.camera, [
    '/september/assets/hand-landmarker.worker-B.js',
    '/september/assets/september-camera-A.js',
    '/september/models/hand-landmarker-float16-v1.task',
    '/september/vendor/mediapipe/vision_bundle.mjs',
    '/september/vendor/mediapipe/vision_wasm_internal.js',
    '/september/vendor/mediapipe/vision_wasm_internal.wasm',
  ]);
});

test('compact Rollup static imports and re-exports stay in the eager closure', () => {
  const artifacts = [
    {
      url: '/september/index.html',
      contentType: 'text/html',
      source: '<script type="module" src="./assets/index-Abcdef12.js"></script>',
    },
    {
      url: '/september/assets/index-Abcdef12.js',
      contentType: 'text/javascript',
      source: [
        'import{mount}from"./compact-entry-A.js";',
        'export{copy}from"./compact-copy-B.js";',
        'import("./lazy-camera-C.js");',
      ].join('\n'),
    },
    {
      url: '/september/assets/compact-entry-A.js',
      contentType: 'text/javascript',
      source: 'export{shared}from"./compact-shared-D.js";',
    },
    {
      url: '/september/assets/compact-copy-B.js',
      contentType: 'text/javascript',
      source: 'export const copy = true;',
    },
    {
      url: '/september/assets/compact-shared-D.js',
      contentType: 'text/javascript',
      source: 'export const shared = true;',
    },
    {
      url: '/september/assets/lazy-camera-C.js',
      contentType: 'text/javascript',
      source: 'export const lazy = true;',
    },
  ];

  const result = analyzeRuntimeArtifacts({
    artifacts,
    routes: validManifest().routes.filter(({ id }) => id === 'september'),
    siteOrigin: site.origin,
  });

  assert.deepEqual(result.initialAssetUrlsByRoute.september, [
    '/september/assets/compact-copy-B.js',
    '/september/assets/compact-entry-A.js',
    '/september/assets/compact-shared-D.js',
    '/september/assets/index-Abcdef12.js',
    '/september/index.html',
  ]);
  assert.deepEqual(result.lazyAssetUrlsByRoute.september, [
    '/september/assets/lazy-camera-C.js',
  ]);
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

test('September camera profile stays empty until its dynamic root is emitted', () => {
  const artifacts = [
    {
      url: '/september/index.html',
      contentType: 'text/html',
      source: '<script type="module" src="./assets/index-Abcdef12.js"></script>',
    },
    {
      url: '/september/assets/index-Abcdef12.js',
      contentType: 'text/javascript',
      source: 'console.log("legacy scene");',
    },
    { url: '/september/models/hand-landmarker-float16-v1.task', contentType: 'application/octet-stream' },
    { url: '/september/vendor/mediapipe/vision_bundle.mjs', contentType: 'text/javascript' },
    { url: '/september/vendor/mediapipe/vision_wasm_internal.js', contentType: 'text/javascript' },
    { url: '/september/vendor/mediapipe/vision_wasm_internal.wasm', contentType: 'application/wasm' },
  ];

  const result = analyzeRuntimeArtifacts({
    artifacts,
    routes: validManifest().routes.filter(({ id }) => id === 'september'),
    siteOrigin: site.origin,
  });

  assert.deepEqual(result.runtimeProfilesByRoute.september.camera, []);
});

test('September camera profile budget is isolated from Birthday MediaPipe assets', () => {
  assert.deepEqual(
    validateBuildManifest(validManifestWithBirthdayAndSeptemberMediaPipe(), site),
    [],
  );
});

test('preview manifest rejects an omitted registry route even when catalog marks it unbuilt', () => {
  const manifest = validProductionManifest();
  const errors = validateBuildManifest(manifest, site, {
    environment: 'preview',
  }).join('\n');

  assert.match(errors, /Manifest routes do not match/i);
  assert.match(errors, /september has no critical asset/i);
  assert.match(errors, /september initial dependency closure is missing/i);
});

test('build manifest rejects a missing Open Graph image for a built route', () => {
  const manifest = validManifest();
  manifest.assets = manifest.assets.filter(({ url }) => url !== '/birthday/og-preview.jpg');

  assert.match(
    validateBuildManifest(manifest, site).join('\n'),
    /birthday Open Graph image \/birthday\/og-preview\.jpg is missing/i,
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

test('build manifest rejects duplicate camera profile assets', () => {
  const manifest = validManifest();
  manifest.runtimeProfilesByRoute.september.camera = [
    '/september/assets/index-Abcdef12.js',
    '/september/assets/index-Abcdef12.js',
  ];

  assert.match(
    validateBuildManifest(manifest, site).join('\n'),
    /september camera profile contains duplicates/i,
  );
});

test('build manifest rejects an oversized individual camera artifact', () => {
  const manifest = validManifestWithBirthdayAndSeptemberMediaPipe();
  manifest.assets.find(({ url }) => url.endsWith('vision_wasm_internal.wasm')).bytes = 18 * 1024 * 1024 + 1;

  assert.match(
    validateBuildManifest(manifest, site).join('\n'),
    /individual MediaPipe file limit is 18 MiB/i,
  );
});

test('build manifest requires the selected camera public runtime with its camera root', () => {
  const manifest = validManifestWithBirthdayAndSeptemberMediaPipe();
  manifest.runtimeProfilesByRoute.september.camera = manifest.runtimeProfilesByRoute.september.camera
    .filter(url => !url.endsWith('vision_wasm_internal.wasm'));

  assert.match(
    validateBuildManifest(manifest, site).join('\n'),
    /September camera profile is missing selected runtime .*vision_wasm_internal\.wasm/i,
  );
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
