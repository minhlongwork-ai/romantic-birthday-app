#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applySiteMetadata } from './site-metadata.mjs';
import { loadSiteConfig } from './site-config.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stagingDir = resolve(projectRoot, 'staging');
const distDir = resolve(projectRoot, 'dist');
const viteBin = resolve(projectRoot, 'node_modules/vite/bin/vite.js');
const emittedPaths = new Set();
const site = await loadSiteConfig();

const routeBuilds = Object.freeze([
  {
    id: 'chooser',
    path: site.routes.chooser,
    config: resolve(projectRoot, 'portal/vite.config.js'),
    output: resolve(stagingDir, 'portal'),
    destination: distDir,
    index: '/index.html',
  },
  {
    id: 'birthday',
    path: site.routes.birthday,
    config: resolve(projectRoot, 'vite.config.js'),
    output: resolve(stagingDir, 'birthday'),
    destination: resolve(distDir, 'birthday'),
    index: '/birthday/index.html',
  },
  {
    id: 'august',
    path: site.routes.august,
    config: resolve(projectRoot, 'apps/august/vite.config.js'),
    output: resolve(stagingDir, 'august'),
    destination: resolve(distDir, 'august'),
    index: '/august/index.html',
  },
  {
    id: 'september',
    path: site.routes.september,
    config: resolve(projectRoot, 'apps/september/vite.config.js'),
    output: resolve(stagingDir, 'september'),
    destination: resolve(distDir, 'september'),
    index: '/september/index.html',
  },
]);

function run(command, args, cwd = projectRoot) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}.`));
    });
  });
}

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const files = [];
  for (const entry of entries) {
    const relativePath = join(prefix, entry.name);
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(absolutePath, relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

async function copyTree(source, destination) {
  const files = await listFiles(source);
  for (const relativePath of files) {
    const normalized = relativePath.split(sep).join('/');
    const target = resolve(destination, relativePath);
    const outputKey = relative(distDir, target).split(sep).join('/');
    if (outputKey.startsWith('../') || outputKey === '..') {
      throw new Error(`Assembly target escaped dist: ${target}`);
    }
    if (emittedPaths.has(outputKey)) {
      throw new Error(`Composite asset collision: /${outputKey}`);
    }
    emittedPaths.add(outputKey);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(source, relativePath), target);
  }
}

async function copyStandalone(source, outputKey) {
  const normalized = outputKey.split(sep).join('/').replace(/^\/+/, '');
  if (emittedPaths.has(normalized)) {
    throw new Error(`Composite asset collision: /${normalized}`);
  }
  emittedPaths.add(normalized);
  const target = resolve(distDir, normalized);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

function contentTypeFor(pathname) {
  const types = new Map([
    ['.html', 'text/html'],
    ['.js', 'text/javascript'],
    ['.css', 'text/css'],
    ['.json', 'application/json'],
    ['.webmanifest', 'application/manifest+json'],
    ['.svg', 'image/svg+xml'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.png', 'image/png'],
    ['.webp', 'image/webp'],
    ['.avif', 'image/avif'],
    ['.woff2', 'font/woff2'],
    ['.mp3', 'audio/mpeg'],
    ['.txt', 'text/plain'],
    ['.wasm', 'application/wasm'],
    ['.tflite', 'application/octet-stream'],
    ['.data', 'application/octet-stream'],
  ]);
  return types.get(extname(pathname).toLowerCase()) || 'application/octet-stream';
}

function routeForUrl(url) {
  if (url.startsWith('/birthday/')) return 'birthday';
  if (url.startsWith('/august/')) return 'august';
  if (url.startsWith('/september/')) return 'september';
  return 'chooser';
}

function isCriticalAsset(url, routeId, entryAssets) {
  if (url === routeBuilds.find(route => route.id === routeId)?.index) return true;
  if (entryAssets.has(url)) return true;
  if (routeId === 'chooser') {
    return url === '/chooser-birthday.webp'
      || url === '/fonts/cormorant-garamond-vi.woff2'
      || url === '/fonts/cormorant-garamond-latin.woff2';
  }
  if (routeId === 'birthday') {
    return /\/assets\/(?:manrope-vietnamese-400|cormorant-garamond-vietnamese-400)-/.test(url)
      || url.endsWith('/images/1.webp');
  }
  if (routeId === 'august') {
    return url.endsWith('/public/fonts/cormorant-garamond-vi.woff2')
      || url.endsWith('/public/images/herbarium/poppy.webp');
  }
  if (routeId === 'september') {
    return url.endsWith('/preview.webp');
  }
  return false;
}

function extractEntryAssets(html, routePath) {
  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
    urls.add(new URL(match[1], new URL(routePath, site.origin)).pathname);
  }
  return urls;
}

async function getBuildSha() {
  let output = '';
  await new Promise(resolvePromise => {
    const child = spawn('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    child.stdout.on('data', chunk => { output += chunk; });
    child.once('exit', () => resolvePromise());
    child.once('error', () => resolvePromise());
  });
  const sha = output.trim();
  return /^[a-f0-9]{7,40}$/.test(sha)
    ? sha
    : `local-${createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 12)}`;
}

await Promise.all([
  access(resolve(projectRoot, 'portal/index.html')),
  access(resolve(projectRoot, 'apps/august/index.html')),
  access(resolve(projectRoot, 'apps/september/index.html')),
]);
await rm(stagingDir, { recursive: true, force: true });
await rm(distDir, { recursive: true, force: true });
await mkdir(stagingDir, { recursive: true });
await mkdir(distDir, { recursive: true });

await run(process.execPath, ['scripts/generate-share-qr.mjs']);
await run(process.execPath, ['scripts/validate-gift.mjs']);
await run(process.execPath, ['apps/august/scripts/validate.mjs']);
await run(process.execPath, ['apps/september/scripts/validate.mjs']);

for (const route of routeBuilds) {
  await run(process.execPath, [
    viteBin,
    'build',
    '--config',
    route.config,
    '--outDir',
    route.output,
    '--emptyOutDir',
  ]);
}

await run(process.execPath, [
  'scripts/finalize-service-worker.mjs',
  resolve(stagingDir, 'birthday'),
]);
await rm(resolve(stagingDir, 'birthday/.vite'), { recursive: true, force: true });

for (const route of routeBuilds) {
  await copyTree(route.output, route.destination);
}
await copyTree(
  resolve(projectRoot, 'apps/august/public'),
  resolve(distDir, 'august/public'),
);
await copyStandalone(
  resolve(projectRoot, 'public/images/swarovski-dancing-swan-5514421.webp'),
  'chooser-birthday.webp',
);
await copyStandalone(
  resolve(projectRoot, 'apps/august/public/fonts/cormorant-garamond-vi.woff2'),
  'fonts/cormorant-garamond-vi.woff2',
);
await copyStandalone(
  resolve(projectRoot, 'apps/august/public/fonts/cormorant-garamond-latin.woff2'),
  'fonts/cormorant-garamond-latin.woff2',
);
await copyStandalone(
  resolve(projectRoot, 'portal/service-worker.js'),
  'service-worker.js',
);

const notFoundSource = await readFile(resolve(projectRoot, 'portal/404.html'), 'utf8');
await writeFile(resolve(distDir, '404.html'), applySiteMetadata(notFoundSource, site, 'chooser'));
emittedPaths.add('404.html');

const entryAssets = new Set();
for (const route of routeBuilds) {
  const html = await readFile(resolve(distDir, route.index.replace(/^\//, '')), 'utf8');
  extractEntryAssets(html, route.path).forEach(url => entryAssets.add(url));
}

const outputFiles = (await listFiles(distDir))
  .map(pathname => pathname.split(sep).join('/'))
  .filter(pathname => pathname !== 'build-manifest.json');
const assets = [];
for (const pathname of outputFiles) {
  if (pathname.endsWith('.map')) {
    throw new Error(`Source map cannot be published: /${pathname}`);
  }
  const absolutePath = resolve(distDir, pathname);
  const source = await readFile(absolutePath);
  const url = `/${pathname}`;
  const route = routeForUrl(url);
  assets.push({
    route,
    url,
    sha256: createHash('sha256').update(source).digest('hex'),
    bytes: (await stat(absolutePath)).size,
    contentType: contentTypeFor(pathname),
    critical: isCriticalAsset(url, route, entryAssets),
  });
}

const buildManifest = {
  buildSha: await getBuildSha(),
  routes: routeBuilds.map(({ id, path, index }) => ({ id, path, index })),
  assets,
  externalRuntimeUrls: [],
};
await writeFile(
  resolve(distDir, 'build-manifest.json'),
  `${JSON.stringify(buildManifest, null, 2)}\n`,
);

await run(process.execPath, ['scripts/validate-build.mjs']);

await rm(stagingDir, { recursive: true, force: true });
console.log('Composite Vite site built with hashed chooser, Birthday, August, and September bundles.');
