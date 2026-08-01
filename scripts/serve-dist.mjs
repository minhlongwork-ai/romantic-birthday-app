#!/usr/bin/env node

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import {
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distDirectory = resolve(projectRoot, 'dist');
const port = Number(process.env.E2E_PORT || process.env.PORT || 4183);
const host = process.env.HOST || '127.0.0.1';
const requestedBase = process.env.E2E_BASE_PATH || '/';
const basePath = requestedBase === '/'
  ? '/'
  : `/${requestedBase.replace(/^\/+|\/+$/g, '')}/`;
const legacyPassThroughWorkerPath =
  `${basePath}__e2e__/legacy-pass-through-service-worker.js`;
const legacyCacheFirstWorkerPath =
  `${basePath}__e2e__/legacy-cache-first-service-worker.js`;
const serviceWorkerFixtureClientPath = `${basePath}__e2e__/client.html`;
const legacyPassThroughWorker = `
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
`;
const legacyCacheFirstWorker = `
const CACHE_NAME = 'static-birthday-keepsake-e2e-cached-root';
const INDEX_URL = new URL('index.html', self.registration.scope).href;
const LEGACY_HTML = '<!doctype html><html><head><title>Legacy Birthday Cache</title></head>' +
  '<body><h1>Legacy Birthday Cache</h1><script>' +
  'setTimeout(() => navigator.serviceWorker.register("./service-worker.js", ' +
  '{ scope: "./", updateViaCache: "none" }), 150);' +
  '</scr' + 'ipt></body></html>';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.put(
        INDEX_URL,
        new Response(LEGACY_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
      ))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const requestURL = new URL(event.request.url);
  const scopeURL = new URL(self.registration.scope);
  if (
    event.request.mode === 'navigate' &&
    requestURL.origin === scopeURL.origin &&
    requestURL.pathname === scopeURL.pathname
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => cache.match(INDEX_URL)),
    );
  }
});
`;
const contentTypes = new Map([
  ['.avif', 'image/avif'],
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.wasm', 'application/wasm'],
  ['.webmanifest', 'application/manifest+json'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function resolveDistPath(pathname) {
  const relativePath = pathname.slice(basePath.length) || 'index.html';
  const filePath = resolve(distDirectory, relativePath);
  const resolvedRelative = relative(distDirectory, filePath);
  if (resolvedRelative.startsWith('..') || isAbsolute(resolvedRelative)) {
    return null;
  }
  return filePath;
}

async function findResponseFile(request) {
  const url = new URL(request.url, `http://${host}:${port}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return { status: 400 };
  }

  if (!pathname.startsWith(basePath)) {
    return { status: 404 };
  }

  const filePath = resolveDistPath(pathname);
  if (!filePath) return { status: 403 };

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isFile()) return { filePath, status: 200 };
    if (fileStat.isDirectory()) {
      const indexPath = join(filePath, 'index.html');
      const indexStat = await stat(indexPath).catch(() => null);
      if (indexStat?.isFile()) return { filePath: indexPath, status: 200 };
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const acceptsHtml = request.headers.accept?.includes('text/html');
  return acceptsHtml
    ? { filePath: resolve(distDirectory, 'index.html'), status: 200 }
    : { status: 404 };
}

const server = createServer(async (request, response) => {
  try {
    const requestURL = new URL(request.url, `http://${host}:${port}`);
    if (requestURL.pathname === serviceWorkerFixtureClientPath) {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end('<!doctype html><title>Service worker fixture client</title>');
      return;
    }
    if (requestURL.pathname === legacyPassThroughWorkerPath) {
      response.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
        'Service-Worker-Allowed': basePath,
      });
      response.end(legacyPassThroughWorker);
      return;
    }
    if (requestURL.pathname === legacyCacheFirstWorkerPath) {
      response.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
        'Service-Worker-Allowed': basePath,
      });
      response.end(legacyCacheFirstWorker);
      return;
    }

    const result = await findResponseFile(request);
    if (!result.filePath) {
      response.writeHead(result.status);
      response.end();
      return;
    }

    response.writeHead(result.status, {
      'Content-Type': contentTypes.get(extname(result.filePath)) || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(result.filePath).pipe(response);
  } catch (error) {
    console.error(error);
    response.writeHead(500);
    response.end();
  }
});

server.listen(port, host, () => {
  console.log(`Serving dist at http://${host}:${port}${basePath}`);
});
