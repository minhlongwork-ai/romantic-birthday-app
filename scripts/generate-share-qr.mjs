#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gift = JSON.parse(
  await readFile(resolve(projectRoot, 'src/content/gift.json'), 'utf8'),
);
const publicUrl = process.env.GIFT_PUBLIC_URL || gift.sharing?.publicUrl;
const outputPath = resolve(
  process.env.QR_OUTPUT_PATH || resolve(projectRoot, 'public/share-qr.svg'),
);

function validatePublicUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('sharing.publicUrl must be a valid absolute URL.');
  }
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error(
      'sharing.publicUrl must use HTTPS and cannot contain credentials, query parameters, or a fragment.',
    );
  }
  return url.href;
}

const safeUrl = validatePublicUrl(publicUrl);
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
