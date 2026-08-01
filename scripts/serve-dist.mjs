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
