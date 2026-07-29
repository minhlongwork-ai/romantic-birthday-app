#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(process.argv[2] || resolve(projectRoot, 'dist'));
const manifestPath = resolve(distDir, '.vite/manifest.json');
const indexPath = resolve(distDir, 'index.html');
const serviceWorkerPath = resolve(distDir, 'service-worker.js');

async function updateHashWithDirectory(hash, directory, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const relativePath = join(relativeDirectory, entry.name);
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await updateHashWithDirectory(hash, absolutePath, relativePath);
    } else if (entry.isFile() && relativePath !== 'service-worker.js') {
      hash.update(relativePath);
      hash.update(await readFile(absolutePath));
    }
  }
}

const [manifestSource, indexSource, serviceWorkerSource] = await Promise.all([
  readFile(manifestPath, 'utf8'),
  readFile(indexPath, 'utf8'),
  readFile(serviceWorkerPath, 'utf8'),
]);

const manifest = JSON.parse(manifestSource);
const entryAssets = new Set();

for (const item of Object.values(manifest)) {
  if (!item.isEntry) continue;
  if (item.file) entryAssets.add(item.file);
  item.css?.forEach(file => entryAssets.add(file));
  item.assets
    ?.filter(file => !file.endsWith('.woff'))
    .forEach(file => entryAssets.add(file));
}

if (entryAssets.size === 0) {
  throw new Error('Vite manifest does not contain an entry asset to precache.');
}

const revisionHash = createHash('sha256')
  .update(manifestSource)
  .update(indexSource)
  .update(serviceWorkerSource);
await updateHashWithDirectory(revisionHash, distDir);
const buildHash = revisionHash
  .digest('hex')
  .slice(0, 12);

const finalizedSource = serviceWorkerSource
  .replace('__BUILD_CACHE_VERSION__', `birthday-album-${buildHash}`)
  .replace(
    '/*__BUILD_ASSETS__*/ []',
    JSON.stringify([...entryAssets].sort(), null, 2),
  );

if (finalizedSource === serviceWorkerSource) {
  throw new Error('Service worker build placeholders were not replaced.');
}
if (finalizedSource.includes('__BUILD_')) {
  throw new Error('Service worker still contains an unresolved build placeholder.');
}

await writeFile(serviceWorkerPath, finalizedSource);
console.log(
  `Finalized service worker ${buildHash} with ${entryAssets.size} entry asset(s).`,
);
