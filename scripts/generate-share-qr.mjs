#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

import { buildShareUrl, loadSiteConfig } from './site-config.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(
  process.env.QR_OUTPUT_PATH || resolve(projectRoot, 'public/share-qr.svg'),
);
const site = await loadSiteConfig();
const safeUrl = buildShareUrl(site, 'birthday');
const urlDigest = createHash('sha256').update(safeUrl).digest('hex');
const qrSvg = await QRCode.toString(safeUrl, {
  type: 'svg',
  errorCorrectionLevel: 'M',
  margin: 4,
  width: 512,
  color: {
    dark: '#292526',
    light: '#fffaf2',
  },
});
const finalizedSvg = qrSvg.replace(
  '<svg',
  `<!-- gift-public-url-sha256:${urlDigest} -->\n<svg`,
);

await writeFile(outputPath, `${finalizedSvg.trim()}\n`, 'utf8');
console.log(`Generated safe share QR for ${safeUrl}`);
