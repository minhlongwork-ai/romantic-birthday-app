#!/usr/bin/env node

import { spawn } from 'node:child_process';
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(projectRoot, 'dist');
const birthdayDistDir = resolve(distDir, 'birthday');
const portalDir = resolve(projectRoot, 'portal');
const augustDir = resolve(projectRoot, 'apps/august');
const augustDistDir = resolve(distDir, 'august');
const viteBin = resolve(projectRoot, 'node_modules/vite/bin/vite.js');

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}.`));
    });
  });
}

async function assertDirectory(path, label) {
  const entry = await stat(path).catch(() => null);
  if (!entry?.isDirectory()) {
    throw new Error(`${label} is missing at ${path}.`);
  }
}

async function copyDirectoryContents(source, destination) {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  await Promise.all(entries.map(entry => (
    cp(join(source, entry.name), join(destination, entry.name), {
      recursive: entry.isDirectory(),
    })
  )));
}

async function validatePortal() {
  const html = await readFile(resolve(portalDir, 'index.html'), 'utf8');
  const requiredFragments = [
    './birthday/',
    './august/',
    'data-project-link',
    'portal.css',
    'portal.js',
  ];
  const missing = requiredFragments.filter(fragment => !html.includes(fragment));
  if (missing.length > 0) {
    throw new Error(`Portal is missing required markup: ${missing.join(', ')}.`);
  }
}

await Promise.all([
  assertDirectory(portalDir, 'Portal source'),
  assertDirectory(augustDir, 'August Herbarium source'),
]);

await validatePortal();
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await run(process.execPath, ['scripts/generate-share-qr.mjs']);
await run(process.execPath, ['scripts/validate-gift.mjs']);
await run(process.execPath, ['apps/august/scripts/validate.mjs']);
await run(process.execPath, [
  viteBin,
  'build',
  '--outDir',
  'dist/birthday',
  '--emptyOutDir',
]);
await run(process.execPath, [
  'scripts/finalize-service-worker.mjs',
  'dist/birthday',
]);

await copyDirectoryContents(portalDir, distDir);

await mkdir(augustDistDir, { recursive: true });
await Promise.all([
  cp(resolve(augustDir, 'index.html'), resolve(augustDistDir, 'index.html')),
  cp(resolve(augustDir, 'src'), resolve(augustDistDir, 'src'), { recursive: true }),
  cp(resolve(augustDir, 'public'), resolve(augustDistDir, 'public'), { recursive: true }),
]);

console.log('Composite site built: chooser + birthday + August Herbarium.');
