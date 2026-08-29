#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadSiteConfig } from './site-config.mjs';
import { analyzeRuntimeArtifacts } from './runtime-dependencies.mjs';

const JAVASCRIPT_CONTENT_TYPES = new Set([
  'application/javascript',
  'text/javascript',
]);

export function contentTypeMatches(expected, actual) {
  const expectedType = String(expected || '').split(';', 1)[0].trim().toLowerCase();
  const actualType = String(actual || '').split(';', 1)[0].trim().toLowerCase();
  if (expectedType === actualType) return true;
  return JAVASCRIPT_CONTENT_TYPES.has(expectedType)
    && JAVASCRIPT_CONTENT_TYPES.has(actualType);
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HASHED_APPLICATION_ASSET = /\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:css|js)$/;
const SHA256 = /^[a-f0-9]{64}$/;
const BUILD_SHA = /^[a-f0-9]{7,40}$|^local-[a-f0-9]{12}$/;
const FORBIDDEN_RUNTIME_ASSET = /(?:hand_landmark_full\.tflite|(?:^|[/_.-])(?:rain|moon)(?:[/_.-]|$))/i;

function expectedRoutes(site) {
  return [
    { id: 'chooser', path: site.routes.chooser, index: '/index.html' },
    { id: 'birthday', path: site.routes.birthday, index: '/birthday/index.html' },
    { id: 'august', path: site.routes.august, index: '/august/index.html' },
    { id: 'september', path: site.routes.september, index: '/september/index.html' },
  ];
}

function isSameOriginPath(value) {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\')
    && !value.split('/').includes('..');
}

export function validateNotFoundDocument(html) {
  const source = String(html || '');
  const errors = [];
  if (!/<meta\s+name=["']robots["']\s+content=["'][^"']*\bnoindex\b[^"']*["']/i.test(source)) {
    errors.push('Shared 404 document must include a robots noindex directive.');
  }
  if (!/<a\s+[^>]*href=["']\/["']/i.test(source)) {
    errors.push('Shared 404 document must link back to the chooser.');
  }
  if (/%SITE_[A-Z_]+%|github\.io/i.test(source)) {
    errors.push('Shared 404 document contains a stale metadata placeholder.');
  }
  return errors;
}

export function validateBuildManifest(manifest, site) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return ['Build manifest must be an object.'];
  if (!BUILD_SHA.test(manifest.buildSha || '')) errors.push('buildSha is missing or invalid.');

  const routes = Array.isArray(manifest.routes) ? manifest.routes : [];
  if (JSON.stringify(routes) !== JSON.stringify(expectedRoutes(site))) {
    errors.push('Manifest routes do not match the canonical site config.');
  }

  const externalRuntimeUrls = Array.isArray(manifest.externalRuntimeUrls)
    ? manifest.externalRuntimeUrls
    : [];
  if (externalRuntimeUrls.length > 0) {
    errors.push(`External runtime URL list must be empty: ${externalRuntimeUrls.join(', ')}`);
  }

  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  if (assets.length === 0) errors.push('Manifest assets must not be empty.');
  const seen = new Set();
  for (const asset of assets) {
    const label = asset?.url || '(missing URL)';
    if (!isSameOriginPath(asset?.url)) errors.push(`${label} must be a same-origin path.`);
    if (seen.has(asset?.url)) errors.push(`Duplicate manifest asset: ${label}`);
    seen.add(asset?.url);
    if (!['chooser', 'birthday', 'august', 'september'].includes(asset?.route)) {
      errors.push(`${label} has an invalid route owner.`);
    }
    if (asset?.route === 'september' && !String(asset?.url || '').startsWith('/september/')) {
      errors.push(`${label} must remain inside the September namespace (/september/).`);
    }
    if (!SHA256.test(asset?.sha256 || '')) errors.push(`${label} has an invalid SHA-256 digest.`);
    if (!Number.isSafeInteger(asset?.bytes) || asset.bytes <= 0) {
      errors.push(`${label} has an invalid byte size.`);
    }
    if (typeof asset?.contentType !== 'string' || !asset.contentType.includes('/')) {
      errors.push(`${label} has an invalid content type.`);
    }
    if (typeof asset?.critical !== 'boolean') errors.push(`${label} has no critical flag.`);
    if (/\/assets\/.*\.(?:css|js)$/i.test(asset?.url || '')
      && !HASHED_APPLICATION_ASSET.test(asset.url)) {
      errors.push(`${label} must use a hashed filename.`);
    }
    if (FORBIDDEN_RUNTIME_ASSET.test(asset?.url || '')) {
      errors.push(`${label} includes a forbidden Rain, Moon, or full MediaPipe model asset.`);
    }
  }

  for (const route of expectedRoutes(site)) {
    if (!assets.some(asset => asset.route === route.id && asset.critical === true)) {
      errors.push(`${route.id} has no critical asset.`);
    }
  }
  const initialAssetUrlsByRoute = manifest.initialAssetUrlsByRoute;
  if (!initialAssetUrlsByRoute || typeof initialAssetUrlsByRoute !== 'object') {
    errors.push('Manifest initial dependency closures are missing.');
  }
  for (const route of expectedRoutes(site)) {
    const initialUrls = initialAssetUrlsByRoute?.[route.id];
    if (!Array.isArray(initialUrls)) {
      errors.push(`${route.id} initial dependency closure is missing.`);
      continue;
    }
    if (new Set(initialUrls).size !== initialUrls.length) {
      errors.push(`${route.id} initial dependency closure contains duplicates.`);
    }
    for (const url of initialUrls) {
      if (!assets.some(asset => asset.url === url)) {
        errors.push(`${route.id} initial dependency closure references missing asset ${url}.`);
      }
    }
  }
  const septemberInitialUrls = [...(initialAssetUrlsByRoute?.september || [])].sort();
  const septemberCriticalUrls = assets
    .filter(asset => asset?.route === 'september' && asset?.critical === true)
    .map(({ url }) => url)
    .sort();
  if (JSON.stringify(septemberInitialUrls) !== JSON.stringify(septemberCriticalUrls)) {
    errors.push('September initial dependency closure must exactly match its critical asset flags.');
  }
  const septemberInitialBytes = assets
    .filter(asset => septemberInitialUrls.includes(asset?.url))
    .reduce((total, asset) => total + (Number.isSafeInteger(asset.bytes) ? asset.bytes : 0), 0);
  if (septemberInitialBytes > 500 * 1024) {
    errors.push(`September initial transfer is ${septemberInitialBytes} bytes; limit is 500 KB.`);
  }
  return errors;
}

export async function validateBuildOutput({
  distDir = resolve(projectRoot, 'dist'),
  site,
} = {}) {
  const resolvedSite = site || await loadSiteConfig();
  const manifestPath = resolve(distDir, 'build-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const errors = validateBuildManifest(manifest, resolvedSite);
  let mediaPipeBytes = 0;
  const runtimeArtifacts = [];

  for (const asset of manifest.assets || []) {
    if (!isSameOriginPath(asset.url)) continue;
    const outputPath = resolve(distDir, asset.url.replace(/^\//, ''));
    try {
      const file = await readFile(outputPath);
      const fileStat = await stat(outputPath);
      const digest = createHash('sha256').update(file).digest('hex');
      if (fileStat.size !== asset.bytes) errors.push(`${asset.url} byte size does not match disk.`);
      if (digest !== asset.sha256) errors.push(`${asset.url} digest does not match disk.`);
      if (asset.url.endsWith('.map')) errors.push(`${asset.url} is a published source map.`);
      if (asset.url.includes('/vendor/mediapipe/')) mediaPipeBytes += fileStat.size;
      runtimeArtifacts.push({
        url: asset.url,
        contentType: asset.contentType,
        source: ['text/html', 'text/css', 'text/javascript'].includes(asset.contentType)
          ? file.toString('utf8')
          : undefined,
      });
    } catch (error) {
      errors.push(`${asset.url} is missing from dist: ${error.message}`);
    }
  }

  const requiredMediaPipeAssets = [
    '/birthday/vendor/mediapipe/hands/hands_solution_wasm_bin.wasm',
    '/birthday/vendor/mediapipe/hands/hands_solution_simd_wasm_bin.wasm',
  ];
  for (const url of requiredMediaPipeAssets) {
    if (!(manifest.assets || []).some(asset => asset.url === url)) {
      errors.push(`Required MediaPipe fallback is missing: ${url}`);
    }
  }
  if (mediaPipeBytes > 18 * 1024 * 1024) {
    errors.push(`MediaPipe runtime is ${(mediaPipeBytes / 1024 / 1024).toFixed(2)} MiB; limit is 18 MiB.`);
  }

  const runtimeAnalysis = analyzeRuntimeArtifacts({
    artifacts: runtimeArtifacts,
    routes: expectedRoutes(resolvedSite),
    siteOrigin: resolvedSite.origin,
  });
  if (
    JSON.stringify(runtimeAnalysis.externalRuntimeUrls)
      !== JSON.stringify(manifest.externalRuntimeUrls)
  ) {
    errors.push('Manifest external runtime URLs do not match the built artifacts.');
  }
  if (
    JSON.stringify(runtimeAnalysis.initialAssetUrlsByRoute)
      !== JSON.stringify(manifest.initialAssetUrlsByRoute)
  ) {
    errors.push('Manifest initial dependency closures do not match the built artifacts.');
  }
  if (runtimeAnalysis.missingRuntimeUrls.length > 0) {
    errors.push(
      `Built artifacts reference missing initial dependencies: ${runtimeAnalysis.missingRuntimeUrls.join(', ')}.`,
    );
  }

  for (const route of expectedRoutes(resolvedSite)) {
    try {
      const html = await readFile(resolve(distDir, route.index.replace(/^\//, '')), 'utf8');
      const canonical = new URL(route.path, resolvedSite.origin).href;
      if (!html.includes(canonical)) errors.push(`${route.index} is missing canonical URL ${canonical}.`);
      if (/%SITE_[A-Z_]+%|github\.io/i.test(html)) errors.push(`${route.index} contains stale metadata.`);
    } catch (error) {
      errors.push(`${route.index} is missing: ${error.message}`);
    }
  }

  try {
    const notFoundHtml = await readFile(resolve(distDir, '404.html'), 'utf8');
    errors.push(...validateNotFoundDocument(notFoundHtml));
  } catch (error) {
    errors.push(`/404.html is missing: ${error.message}`);
  }

  return { manifest, errors };
}

export async function validateRemoteBuild(baseUrl, {
  fetchImpl = fetch,
  expectedBuildSha,
} = {}) {
  const origin = new URL(baseUrl).origin;
  const manifestResponse = await fetchImpl(new URL('/build-manifest.json', origin));
  if (!manifestResponse.ok) throw new Error(`Remote manifest returned ${manifestResponse.status}.`);
  const manifest = await manifestResponse.json();
  const site = await loadSiteConfig();
  const errors = validateBuildManifest(manifest, site);
  if (expectedBuildSha && manifest.buildSha !== expectedBuildSha) {
    errors.push(`Remote build SHA ${manifest.buildSha || '(missing)'} does not match expected ${expectedBuildSha}.`);
  }

  for (const asset of manifest.assets || []) {
    if (!isSameOriginPath(asset.url)) continue;
    const url = new URL(asset.url, origin);
    const head = await fetchImpl(url, { method: 'HEAD', redirect: 'follow' });
    if (!head.ok) errors.push(`HEAD ${asset.url} returned ${head.status}.`);
    if (asset.critical) {
      const response = await fetchImpl(url, { method: 'GET', redirect: 'follow' });
      if (!response.ok) errors.push(`GET ${asset.url} returned ${response.status}.`);
      const actualType = response.headers.get('content-type') || '';
      if (!contentTypeMatches(asset.contentType, actualType)) {
        errors.push(`GET ${asset.url} returned ${actualType || 'no MIME'}; expected ${asset.contentType}.`);
      }
    }
  }

  for (const route of expectedRoutes(site)) {
    try {
      const response = await fetchImpl(new URL(route.path, origin), {
        method: 'GET',
        redirect: 'follow',
      });
      if (!response.ok) {
        errors.push(`Direct route ${route.path} returned ${response.status}.`);
        continue;
      }
      const actualType = response.headers.get('content-type') || '';
      if (!contentTypeMatches('text/html', actualType)) {
        errors.push(`Direct route ${route.path} returned ${actualType || 'no MIME'}; expected text/html.`);
      }
      const html = await response.text();
      const canonical = new URL(route.path, site.origin).href;
      if (!html.includes(canonical)) {
        errors.push(`Direct route ${route.path} is missing canonical URL ${canonical}.`);
      }
      if (/%SITE_[A-Z_]+%|github\.io/i.test(html)) {
        errors.push(`Direct route ${route.path} contains stale metadata.`);
      }
    } catch (error) {
      errors.push(`Direct route ${route.path} failed: ${error.message}`);
    }
  }

  const missingPath = '/__route_validation_missing__';
  try {
    const response = await fetchImpl(new URL(missingPath, origin), {
      method: 'GET',
      redirect: 'follow',
    });
    if (response.status !== 404) {
      errors.push(`Shared 404 route returned ${response.status}; expected 404.`);
    }
    const actualType = response.headers.get('content-type') || '';
    if (!contentTypeMatches('text/html', actualType)) {
      errors.push(`Shared 404 route returned ${actualType || 'no MIME'}; expected text/html.`);
    }
    errors.push(...validateNotFoundDocument(await response.text()));
  } catch (error) {
    errors.push(`Shared 404 route failed: ${error.message}`);
  }
  return { manifest, errors };
}

async function main() {
  const baseFlag = process.argv.indexOf('--base-url');
  const result = baseFlag >= 0
    ? await validateRemoteBuild(process.argv[baseFlag + 1], {
        expectedBuildSha: process.env.EXPECTED_BUILD_SHA?.trim() || undefined,
      })
    : await validateBuildOutput();
  if (result.errors.length > 0) throw new Error(result.errors.join('\n'));
  console.log(`Build validation passed (${result.manifest.assets.length} assets).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
