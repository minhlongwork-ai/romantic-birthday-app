#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

import { loadSiteConfig } from './site-config.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLACEHOLDER_ALT = /^(?:memory|photo|image|ảnh|hình)(?:\s+|-|_)?\d*$/i;
const ENGLISH_CARD_COPY = /\b(?:dear|happy birthday|yours truly|always and forever|captured happiness)\b/i;

export function validateEditorialContent(gift) {
  const errors = [];
  const editorialCopy = [
    gift?.sender?.name,
    gift?.letter?.greeting,
    ...(gift?.letter?.paragraphs || []),
    gift?.letter?.closing,
    gift?.epilogue?.heading,
    gift?.epilogue?.message,
    ...(gift?.memories || []).flatMap(memory => [memory.caption, memory.chapter]),
  ].filter(Boolean).join(' ');
  if (ENGLISH_CARD_COPY.test(editorialCopy)) {
    errors.push('Birthday editorial copy must be Vietnamese; untranslated English card copy remains.');
  }

  if (!Array.isArray(gift?.memories) || gift.memories.length !== 21) {
    errors.push('Birthday must contain exactly 21 reviewed memories.');
    return errors;
  }

  const ids = new Set();
  gift.memories.forEach((memory, index) => {
    const path = `memories[${index}]`;
    if (!memory?.id || ids.has(memory.id)) errors.push(`${path}.id must be unique.`);
    ids.add(memory?.id);
    if (!memory?.alt || PLACEHOLDER_ALT.test(memory.alt.trim())) {
      errors.push(`${path} contains placeholder alt text.`);
    }
    if (!memory?.caption?.trim()) errors.push(`${path}.caption must be reviewed.`);
    if (!memory?.chapter?.trim()) errors.push(`${path}.chapter must be reviewed.`);
  });
  return errors;
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}.`));
    });
  });
}

async function validateOpenGraph(site) {
  const errors = [];
  const uniquePaths = new Set(Object.values(site.pages).map(page => page.ogImage));
  for (const publicPath of uniquePaths) {
    const filePath = publicPath.startsWith(site.routes.birthday)
      ? resolve(projectRoot, 'public', publicPath.slice(site.routes.birthday.length))
      : publicPath.startsWith(`${site.routes.august}public/`)
        ? resolve(projectRoot, 'apps/august/public', publicPath.slice(`${site.routes.august}public/`.length))
        : resolve(projectRoot, 'portal', publicPath.replace(/^\//, ''));
    try {
      const metadata = await sharp(filePath, { failOn: 'error' }).metadata();
      const fileStat = await stat(filePath);
      if (metadata.width !== 1200 || metadata.height !== 630) {
        errors.push(`${publicPath} must be exactly 1200×630.`);
      }
      if (fileStat.size > 500 * 1024) errors.push(`${publicPath} must be at most 500 KB.`);
    } catch (error) {
      errors.push(`${publicPath} cannot be validated: ${error.message}`);
    }
  }
  return errors;
}

export async function validateSource() {
  const [site, gift] = await Promise.all([
    loadSiteConfig(),
    readFile(resolve(projectRoot, 'src/content/gift.json'), 'utf8').then(JSON.parse),
  ]);
  const errors = [
    ...validateEditorialContent(gift),
    ...await validateOpenGraph(site),
  ];
  if (errors.length > 0) throw new Error(errors.join('\n'));
  await run(process.execPath, ['scripts/validate-gift.mjs']);
  await run(process.execPath, ['apps/august/scripts/validate.mjs']);
  return { site, gift };
}

async function main() {
  const { gift } = await validateSource();
  console.log(`Source validation passed (${gift.memories.length} reviewed memories).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
