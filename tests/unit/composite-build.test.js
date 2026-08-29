import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const distDir = join(projectRoot, 'dist');
const registry = JSON.parse(
  readFileSync(join(projectRoot, 'src/content/experiences.json'), 'utf8'),
).sort((left, right) => left.year - right.year || left.month - right.month);
const obsoleteSeptemberOutputs = [
  ...['cleanser', 'moisturizer', 'lipstick'].flatMap(name =>
    ['avif', 'jpg', 'webp'].map(extension => `/september/images/${name}.${extension}`)),
  ...['new', 'waxing', 'full'].map(phase =>
    `/september/images/source/phase-${phase}.jpg`),
];

function assertSafeSeptemberManifest() {
  const manifestPath = join(distDir, 'build-manifest.json');
  assert.equal(existsSync(manifestPath), true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.deepEqual(manifest.externalRuntimeUrls, []);
  assert.deepEqual(
    manifest.assets.filter(({ url }) => obsoleteSeptemberOutputs.includes(url)),
    [],
  );
  const septemberRuntimeSource = manifest.assets
    .filter(({ route, contentType }) =>
      route === 'september'
        && ['text/css', 'text/html', 'text/javascript', 'application/json'].includes(contentType))
    .map(({ url }) => `${url}\n${readFileSync(join(distDir, url.replace(/^\//, '')), 'utf8')}`)
    .join('\n');
  assert.doesNotMatch(
    septemberRuntimeSource,
    /\b(?:lunar|moon|nasa|orbit|phase)(?:[A-Z_-]|\b)/iu,
  );
  return manifest;
}

test('composite build emits hashed route bundles and a verifiable manifest', () => {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const developmentManifest = assertSafeSeptemberManifest();
  assert.deepEqual(developmentManifest.catalog, registry.map(record => ({
    id: record.id,
    year: record.year,
    month: record.month,
    route: record.route,
    built: true,
    previewPublicPath: record.preview.publicPath,
  })));
  for (const pathname of [
    ...registry.map(record => `${record.build.destination}/index.html`),
    ...registry.map(record => record.preview.publicPath.replace(/^\/+/, '')),
  ]) {
    assert.equal(existsSync(join(distDir, pathname)), true, `${pathname} is missing from dist`);
  }

  const preview = spawnSync('npm', ['run', 'build:vercel'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, VERCEL_ENV: 'preview' },
  });
  assert.equal(preview.status, 0, `${preview.stdout}\n${preview.stderr}`);
  assert.match(preview.stdout, /sender approval gate is deferred to production/u);

  const manifest = assertSafeSeptemberManifest();
  assert.match(manifest.buildSha, /^[a-f0-9]{7,40}$|^local-[a-f0-9]{12}$/);
  assert.deepEqual(
    manifest.routes.map(({ id, path }) => [id, path]),
    [
      ['chooser', '/'],
      ...registry.map(({ id, route }) => [id, route]),
    ],
  );
  const codeAssets = manifest.assets.filter(({ contentType }) =>
    ['text/css', 'text/javascript'].includes(contentType),
  ).filter(({ url }) => url.includes('/assets/'));
  const unhashedApplicationCode = manifest.assets.filter(({ contentType, url }) =>
    ['text/css', 'text/javascript'].includes(contentType)
      && !url.includes('/assets/')
      && !url.endsWith('/service-worker.js')
      && !url.includes('/vendor/mediapipe/'),
  );
  assert.ok(codeAssets.length >= 8);
  assert.deepEqual(unhashedApplicationCode, []);
  assert.ok(
    codeAssets.every(({ url }) => /\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:css|js)$/.test(url)),
  );
  assert.ok(manifest.assets.some(asset => asset.route === 'chooser' && asset.critical));
  assert.ok(manifest.assets.some(asset => asset.route === 'birthday' && asset.critical));
  assert.ok(manifest.assets.some(asset => asset.route === 'august' && asset.critical));
  assert.ok(manifest.assets.some(asset => asset.route === 'september' && asset.critical));
  const septemberInitialUrls = manifest.initialAssetUrlsByRoute?.september;
  assert.ok(Array.isArray(septemberInitialUrls));
  assert.ok(septemberInitialUrls.includes('/september/index.html'));
  assert.ok(septemberInitialUrls.some(url => /\/september\/assets\/.*\.css$/u.test(url)));
  assert.ok(septemberInitialUrls.some(url => /\/september\/assets\/.*\.js$/u.test(url)));
  assert.ok(septemberInitialUrls.some(url => /\/september\/assets\/.*\.woff2$/u.test(url)));
  assert.ok(septemberInitialUrls.includes('/september/images/background-desktop.jpg'));
  assert.equal(septemberInitialUrls.includes('/september/images/preview.webp'), false);
  assert.deepEqual(
    manifest.assets
      .filter(asset => asset.route === 'september' && asset.critical)
      .map(({ url }) => url)
      .sort(),
    septemberInitialUrls,
  );

  for (const asset of manifest.assets) {
    const outputPath = join(distDir, asset.url.replace(/^\//, ''));
    assert.equal(existsSync(outputPath), true, `${asset.url} is missing from dist`);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert.ok(asset.bytes > 0);
  }

  assert.equal(existsSync(join(distDir, '404.html')), true);
  assert.equal(existsSync(join(distDir, 'august/src/main.js')), false);
  assert.equal(existsSync(join(distDir, 'august/public/audio/co-em-madihu-low-g.mp3')), true);
  const portalCss = manifest.assets.find(asset =>
    asset.route === 'chooser' && asset.contentType === 'text/css');
  assert.ok(portalCss);
  assert.match(
    readFileSync(join(distDir, portalCss.url.replace(/^\//, '')), 'utf8'),
    /\/fonts\/cormorant-garamond-vi\.woff2/,
  );
  assert.equal(existsSync(join(distDir, 'chooser-birthday.webp')), false);
  assert.equal(existsSync(join(distDir, 'september', 'images', 'preview.webp')), true);
  assert.equal(manifest.assets.some(asset => asset.url === '/chooser-birthday.webp'), false);
  for (const record of registry) {
    assert.ok(manifest.assets.some(asset =>
      asset.url === record.preview.publicPath && asset.route === 'chooser'));
  }

  for (const route of manifest.routes) {
    const html = readFileSync(join(distDir, route.index.replace(/^\//, '')), 'utf8');
    assert.doesNotMatch(html, /%SITE_[A-Z_]+%|github\.io/);
    assert.match(html, /https:\/\/romantic-birthday-app\.vercel\.app/);
  }
});

test('production assembly excludes the draft route while retaining every chooser preview', () => {
  const result = spawnSync(process.execPath, ['scripts/build-composite.mjs'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, EXPERIENCE_BUILD_ENV: 'production' },
  });

  // Task 6 makes validate-build status-aware. Until then, Task 5 verifies the
  // real production artifacts written immediately before that legacy gate.
  if (result.status !== 0) {
    assert.match(`${result.stdout}\n${result.stderr}`, /Manifest routes do not match/iu);
  }

  const manifest = JSON.parse(readFileSync(join(distDir, 'build-manifest.json'), 'utf8'));
  assert.deepEqual(
    manifest.routes.map(({ id, path }) => [id, path]),
    [
      ['chooser', '/'],
      ...registry
        .filter(({ status }) => status === 'published')
        .map(({ id, route }) => [id, route]),
    ],
  );
  assert.deepEqual(
    manifest.catalog.map(({ id, built }) => [id, built]),
    registry.map(({ id, status }) => [id, status === 'published']),
  );
  assert.deepEqual(manifest.externalRuntimeUrls, []);
  assert.equal(existsSync(join(distDir, 'birthday/index.html')), true);
  assert.equal(existsSync(join(distDir, 'august/index.html')), true);
  assert.equal(existsSync(join(distDir, 'september/index.html')), false);
  assert.equal(existsSync(join(distDir, 'september')), false);
  assert.equal(
    manifest.assets.some(({ route, url }) =>
      route === 'september' || url.startsWith('/september/')),
    false,
  );
  for (const { id } of registry) {
    assert.equal(
      existsSync(join(distDir, 'experience-previews', `${id}.webp`)),
      true,
      `${id} chooser preview is missing from the production artifact`,
    );
  }
});
