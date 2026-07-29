#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const imagesDirectory = path.join(projectRoot, 'public', 'images');
const iconsDirectory = path.join(projectRoot, 'public', 'icons');

const MAX_EDGE = 1600;
const JPEG_QUALITY = 88;
const WEBP_QUALITY = 82;
const AVIF_QUALITY = 50;

const bytes = new Intl.NumberFormat('en-US', {
  style: 'unit',
  unit: 'kilobyte',
  unitDisplay: 'narrow',
  maximumFractionDigits: 1,
});

function formatBytes(value) {
  return bytes.format(value / 1024);
}

function formatDimensions(metadata) {
  return `${metadata.width}×${metadata.height}`;
}

function savings(sourceSize, outputSize) {
  return `${Math.round((1 - outputSize / sourceSize) * 100)}%`;
}

async function sha256(filePath) {
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex');
}

function hasRemovableMetadata(metadata) {
  return Boolean(
    metadata.orientation ||
    metadata.exif ||
    metadata.iptc ||
    metadata.xmp ||
    metadata.icc
  );
}

function assertOptimized(metadata, fileName) {
  if (Math.max(metadata.width, metadata.height) > MAX_EDGE) {
    throw new Error(`${fileName} exceeds the ${MAX_EDGE}px longest-edge limit`);
  }

  if (hasRemovableMetadata(metadata)) {
    throw new Error(`${fileName} still contains removable image metadata`);
  }
}

async function optimizePhotos() {
  const sourceFiles = (await readdir(imagesDirectory))
    .filter((fileName) => /\.jpg$/i.test(fileName))
    .sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true }),
    );

  if (sourceFiles.length === 0) {
    throw new Error(`No JPG sources found in ${imagesDirectory}`);
  }

  const results = [];

  for (const fileName of sourceFiles) {
    const sourcePath = path.join(imagesDirectory, fileName);
    const outputStem = path.parse(fileName).name;
    const jpgTempPath = path.join(imagesDirectory, `.${outputStem}.optimized.jpg`);
    const webpPath = path.join(imagesDirectory, `${outputStem}.webp`);
    const avifPath = path.join(imagesDirectory, `${outputStem}.avif`);
    const input = await readFile(sourcePath);
    const [originalMetadata, originalStats] = await Promise.all([
      sharp(input).metadata(),
      stat(sourcePath),
    ]);
    const rewriteJpeg =
      Math.max(originalMetadata.width, originalMetadata.height) > MAX_EDGE ||
      hasRemovableMetadata(originalMetadata);

    const source = sharp(input, { failOn: 'warning' })
      .autoOrient()
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      });

    try {
      const outputs = [
        source
          .clone()
          .webp({ quality: WEBP_QUALITY, effort: 5, smartSubsample: true })
          .toFile(webpPath),
        source
          .clone()
          .avif({
            quality: AVIF_QUALITY,
            effort: 5,
            chromaSubsampling: '4:2:0',
          })
          .toFile(avifPath),
      ];
      if (rewriteJpeg) {
        outputs.push(
          source
            .clone()
            .jpeg({
              quality: JPEG_QUALITY,
              progressive: true,
              chromaSubsampling: '4:2:0',
            })
            .toFile(jpgTempPath),
        );
      }
      await Promise.all(outputs);
      if (rewriteJpeg) await rename(jpgTempPath, sourcePath);
    } finally {
      await rm(jpgTempPath, { force: true });
    }

    const [
      jpgMetadata,
      webpMetadata,
      avifMetadata,
      jpgStats,
      webpStats,
      avifStats,
    ] = await Promise.all([
      sharp(sourcePath).metadata(),
      sharp(webpPath).metadata(),
      sharp(avifPath).metadata(),
      stat(sourcePath),
      stat(webpPath),
      stat(avifPath),
    ]);

    assertOptimized(jpgMetadata, fileName);
    assertOptimized(webpMetadata, path.basename(webpPath));
    assertOptimized(avifMetadata, path.basename(avifPath));

    results.push({
      source: fileName,
      original: `${formatDimensions(originalMetadata)} · ${formatBytes(originalStats.size)}`,
      jpg: `${formatDimensions(jpgMetadata)} · ${formatBytes(jpgStats.size)} (${savings(originalStats.size, jpgStats.size)} smaller)`,
      webp: `${formatDimensions(webpMetadata)} · ${formatBytes(webpStats.size)} (${savings(originalStats.size, webpStats.size)} smaller)`,
      avif: `${formatDimensions(avifMetadata)} · ${formatBytes(avifStats.size)} (${savings(originalStats.size, avifStats.size)} smaller)`,
      sourceBytes: originalStats.size,
      jpgBytes: jpgStats.size,
      webpBytes: webpStats.size,
      avifBytes: avifStats.size,
    });
  }

  const variantManifest = {
    version: 1,
    images: Object.fromEntries(
      await Promise.all(sourceFiles.map(async fileName => {
        const stem = path.parse(fileName).name;
        const [source, webp, avif] = await Promise.all([
          sha256(path.join(imagesDirectory, fileName)),
          sha256(path.join(imagesDirectory, `${stem}.webp`)),
          sha256(path.join(imagesDirectory, `${stem}.avif`)),
        ]);
        return [fileName, { source, webp, avif }];
      })),
    ),
  };
  await writeFile(
    path.join(imagesDirectory, '.variants.json'),
    `${JSON.stringify(variantManifest, null, 2)}\n`,
    'utf8',
  );

  return results;
}

const brandMarkSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#c85d4b"/>
    <circle cx="76" cy="86" r="8" fill="#f9e9d2" opacity=".55"/>
    <circle cx="438" cy="406" r="12" fill="#f9e9d2" opacity=".4"/>
    <path d="M420 82l8 19 19 8-19 8-8 19-8-19-19-8 19-8z" fill="#f7bf74"/>
    <g transform="rotate(-5 256 266)">
      <rect x="122" y="100" width="268" height="316" rx="18" fill="#8c4037" opacity=".28"/>
      <rect x="108" y="84" width="268" height="316" rx="18" fill="#fff8eb"/>
      <rect x="140" y="120" width="204" height="172" rx="10" fill="#efcda8"/>
      <path d="M140 252l54-56 38 35 38-54 74 75v40H140z" fill="#7a998c"/>
      <circle cx="192" cy="168" r="24" fill="#f7bf74"/>
      <path d="M256 344c-29-30-64-54-64-91 0-25 19-43 43-43 14 0 27 7 35 18 8-11 21-18 35-18 24 0 43 18 43 43 0 37-35 61-64 91l-14 14z" fill="#c85d4b" transform="translate(-14 56) scale(.55)"/>
    </g>
  </svg>
`;

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <title>Memory Scrapbook</title>
  <rect width="64" height="64" rx="14" fill="#c85d4b"/>
  <g transform="rotate(-5 32 33)">
    <rect x="15" y="10" width="34" height="43" rx="3" fill="#fff8eb"/>
    <rect x="19" y="15" width="26" height="21" rx="2" fill="#efcda8"/>
    <path d="M19 31l7-7 5 5 5-7 9 9v5H19z" fill="#7a998c"/>
    <path d="M32 48c-4-4-9-7-9-12 0-3 2-6 6-6 1 0 3 1 4 2 1-1 3-2 4-2 4 0 6 3 6 6 0 5-5 8-9 12l-1 1z" fill="#c85d4b"/>
  </g>
</svg>
`;

const ogPreviewSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff9ed"/>
        <stop offset="1" stop-color="#f2ddbf"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#6a322d" flood-opacity=".18"/>
      </filter>
      <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="2" fill="#c85d4b" opacity=".1"/>
      </pattern>
    </defs>
    <rect width="1200" height="630" fill="url(#paper)"/>
    <rect width="1200" height="630" fill="url(#dots)"/>
    <path d="M0 505c166-51 317-37 469 13 172 56 374 51 731-71v183H0z" fill="#7a998c" opacity=".14"/>
    <path d="M93 84c24-34 47-15 47 7 0-22 24-41 48-7 20 29-18 57-48 80-30-23-68-51-47-80z" fill="#c85d4b" opacity=".18"/>
    <path d="M1090 76l8 19 20 8-20 8-8 20-8-20-19-8 19-8z" fill="#d89a4c"/>
    <path d="M1038 122l4 11 12 5-12 4-4 12-5-12-11-4 11-5z" fill="#c85d4b"/>

    <g filter="url(#shadow)" transform="translate(720 90) rotate(6 180 220)">
      <rect x="8" y="10" width="360" height="440" rx="8" fill="#6a322d" opacity=".16"/>
      <rect width="360" height="440" rx="8" fill="#fffdf7"/>
      <rect x="34" y="34" width="292" height="284" rx="5" fill="#e9c69c"/>
      <circle cx="111" cy="111" r="42" fill="#efb962"/>
      <path d="M34 270l88-88 60 57 55-80 89 103v56H34z" fill="#8eaa9d"/>
      <path d="M34 287l76-61 54 46 40-40 122 86H34z" fill="#587b70" opacity=".72"/>
      <path d="M180 392c-25-24-57-43-57-75 0-22 17-38 38-38 13 0 24 6 31 16 7-10 19-16 31-16 22 0 39 16 39 38 0 32-32 51-57 75l-13 12z" fill="#c85d4b" transform="translate(75 65) scale(.55)"/>
      <path d="M96 375c44-8 91-9 138-4" fill="none" stroke="#d8b58d" stroke-width="7" stroke-linecap="round"/>
      <path d="M96 399c30-5 65-6 99-3" fill="none" stroke="#d8b58d" stroke-width="7" stroke-linecap="round"/>
    </g>

    <g transform="translate(86 195)">
      <rect x="-30" y="-31" width="168" height="36" rx="3" fill="#e7bd83" opacity=".62" transform="rotate(-5)"/>
      <text x="0" y="72" fill="#563731" font-family="Georgia, 'Times New Roman', serif" font-size="86" font-weight="700">Memory</text>
      <text x="0" y="158" fill="#563731" font-family="Georgia, 'Times New Roman', serif" font-size="86" font-weight="700">Scrapbook</text>
      <path d="M2 188c119 13 251 10 417-4" fill="none" stroke="#c85d4b" stroke-width="7" stroke-linecap="round"/>
      <text x="2" y="246" fill="#795d53" font-family="Arial, Helvetica, sans-serif" font-size="28" letter-spacing="3">MOMENTS WORTH KEEPING</text>
    </g>
  </svg>
`;

async function generateBrandAssets() {
  await mkdir(iconsDirectory, { recursive: true });

  const faviconPath = path.join(projectRoot, 'public', 'favicon.svg');
  const ogPreviewPath = path.join(projectRoot, 'public', 'og-preview.jpg');
  const icon192Path = path.join(iconsDirectory, 'icon-192.png');
  const icon512Path = path.join(iconsDirectory, 'icon-512.png');

  await writeFile(faviconPath, `${faviconSvg.trim()}\n`, 'utf8');

  await Promise.all([
    sharp(Buffer.from(ogPreviewSvg))
      .jpeg({
        quality: 88,
        chromaSubsampling: '4:4:4',
        progressive: true,
      })
      .toFile(ogPreviewPath),
    sharp(Buffer.from(brandMarkSvg))
      .flatten({ background: '#c85d4b' })
      .resize(192, 192)
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(icon192Path),
    sharp(Buffer.from(brandMarkSvg))
      .flatten({ background: '#c85d4b' })
      .resize(512, 512)
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(icon512Path),
  ]);

  const rasterAssets = await Promise.all(
    [ogPreviewPath, icon192Path, icon512Path].map(async (assetPath) => {
      const [metadata, assetStats] = await Promise.all([
        sharp(assetPath).metadata(),
        stat(assetPath),
      ]);

      return {
        asset: path.relative(projectRoot, assetPath),
        dimensions: formatDimensions(metadata),
        size: formatBytes(assetStats.size),
      };
    }),
  );

  return [
    {
      asset: path.relative(projectRoot, faviconPath),
      dimensions: 'SVG · 64×64 viewBox',
      size: formatBytes((await stat(faviconPath)).size),
    },
    ...rasterAssets,
  ];
}

async function main() {
  console.log(
    `Optimizing photos (max edge ${MAX_EDGE}px, JPG q${JPEG_QUALITY}, WebP q${WEBP_QUALITY}, AVIF q${AVIF_QUALITY})…`,
  );

  const photoResults = await optimizePhotos();
  const brandAssets = await generateBrandAssets();

  console.table(
    photoResults.map(({ source, original, jpg, webp, avif }) => ({
      source,
      original,
      jpg,
      webp,
      avif,
    })),
  );

  const totals = photoResults.reduce(
    (sum, result) => ({
      sourceBytes: sum.sourceBytes + result.sourceBytes,
      jpgBytes: sum.jpgBytes + result.jpgBytes,
      webpBytes: sum.webpBytes + result.webpBytes,
      avifBytes: sum.avifBytes + result.avifBytes,
    }),
    { sourceBytes: 0, jpgBytes: 0, webpBytes: 0, avifBytes: 0 },
  );

  console.log(
    `Sanitized JPG fallbacks: ${photoResults.length} files, ${formatBytes(totals.jpgBytes)} (${savings(totals.sourceBytes, totals.jpgBytes)} smaller)`,
  );
  console.log(
    `WebP outputs: ${photoResults.length} files, ${formatBytes(totals.webpBytes)} (${savings(totals.sourceBytes, totals.webpBytes)} smaller)`,
  );
  console.log(
    `AVIF outputs: ${photoResults.length} files, ${formatBytes(totals.avifBytes)} (${savings(totals.sourceBytes, totals.avifBytes)} smaller)`,
  );
  console.table(brandAssets);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
