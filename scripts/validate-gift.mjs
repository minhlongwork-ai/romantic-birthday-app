#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { validateGiftConfig } from '../src/lib/gift-config.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEBIBYTE = 1024 * 1024;
const WARNING_LIMITS = new Map([
  ['.jpg', MEBIBYTE],
  ['.jpeg', MEBIBYTE],
  ['.webp', MEBIBYTE],
  ['.png', 2 * MEBIBYTE],
  ['.mp3', 5 * MEBIBYTE],
  ['.m4a', 5 * MEBIBYTE],
  ['.ogg', 5 * MEBIBYTE],
  ['.wav', 10 * MEBIBYTE],
]);
const IMAGE_FORMATS = new Map([
  ['.jpg', 'jpeg'],
  ['.jpeg', 'jpeg'],
  ['.png', 'png'],
  ['.webp', 'webp'],
  ['.avif', 'heif'],
]);
const MAX_MEMORY_EDGE = 1600;
const VARIANT_MANIFEST = '.variants.json';
const RUNTIME_REFERENCES = [
  { field: 'PWA manifest', publicPath: '/manifest.webmanifest' },
  { field: 'favicon', publicPath: '/favicon.svg' },
  { field: 'social preview', publicPath: '/og-preview.jpg' },
  { field: 'safe share QR', publicPath: '/share-qr.svg' },
  { field: 'PWA icon 192', publicPath: '/icons/icon-192.png' },
  { field: 'PWA icon 512', publicPath: '/icons/icon-512.png' },
  { field: 'MediaPipe runtime', publicPath: '/vendor/mediapipe/hands/hands.js' },
  { field: 'MediaPipe graph', publicPath: '/vendor/mediapipe/hands/hands.binarypb' },
  { field: 'MediaPipe full model', publicPath: '/vendor/mediapipe/hands/hand_landmark_full.tflite' },
  { field: 'MediaPipe lite model', publicPath: '/vendor/mediapipe/hands/hand_landmark_lite.tflite' },
  { field: 'MediaPipe assets', publicPath: '/vendor/mediapipe/hands/hands_solution_packed_assets.data' },
  { field: 'MediaPipe assets loader', publicPath: '/vendor/mediapipe/hands/hands_solution_packed_assets_loader.js' },
  { field: 'MediaPipe SIMD data', publicPath: '/vendor/mediapipe/hands/hands_solution_simd_wasm_bin.data' },
  { field: 'MediaPipe SIMD loader', publicPath: '/vendor/mediapipe/hands/hands_solution_simd_wasm_bin.js' },
  { field: 'MediaPipe SIMD WASM', publicPath: '/vendor/mediapipe/hands/hands_solution_simd_wasm_bin.wasm' },
  { field: 'MediaPipe WASM loader', publicPath: '/vendor/mediapipe/hands/hands_solution_wasm_bin.js' },
  { field: 'MediaPipe WASM', publicPath: '/vendor/mediapipe/hands/hands_solution_wasm_bin.wasm' },
];

function parseArguments(argv) {
  const options = {
    configPath: resolve(projectRoot, 'src/content/gift.json'),
    publicDir: resolve(projectRoot, 'public'),
    skipRuntimeAssets: false,
    skipVariantDigests: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === '--skip-runtime-assets') {
      options.skipRuntimeAssets = true;
    } else if (argument === '--skip-variant-digests') {
      options.skipVariantDigests = true;
    } else if (argument === '--config' || argument === '--public-dir') {
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a path.`);
      }
      if (argument === '--config') {
        options.configPath = resolve(value);
      } else {
        options.publicDir = resolve(value);
      }
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function printErrors(errors) {
  console.error(`Gift validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`  - ${error}`));
}

function formatFileSize(bytes) {
  return `${(bytes / MEBIBYTE).toFixed(2)} MiB`;
}

function getSizeWarnings(files) {
  return files.flatMap((file) => {
    const extension = extname(file.publicPath).toLowerCase();
    const limit = WARNING_LIMITS.get(extension) ?? (2 * MEBIBYTE);
    if (file.size <= limit) {
      return [];
    }

    return [
      `${file.field} (${file.publicPath}) is ${formatFileSize(file.size)}, `
      + `above the recommended ${limit / MEBIBYTE} MiB limit.`,
    ];
  });
}

function printWarnings(warnings) {
  if (warnings.length === 0) {
    return;
  }

  console.warn(`Warnings (${warnings.length}):`);
  warnings.forEach((warning) => console.warn(`  - ${warning}`));
}

function getMediaReferences(config, { includeRuntimeAssets }) {
  const getImageReferences = (field, publicPath) => {
    const webpPath = publicPath.replace(
      /\.(jpe?g|png|webp|avif)$/i,
      '.webp',
    );
    const avifPath = publicPath.replace(
      /\.(jpe?g|png|webp|avif)$/i,
      '.avif',
    );
    return [
      { field, publicPath },
      { field: `${field} WebP variant`, publicPath: webpPath },
      { field: `${field} AVIF variant`, publicPath: avifPath },
    ].filter(
      (reference, referenceIndex, references) =>
        references.findIndex(
          candidate => candidate.publicPath === reference.publicPath,
        ) === referenceIndex,
    );
  };
  const references = [
    {
      field: 'soundtrack.src',
      publicPath: config.soundtrack.src,
    },
    ...config.memories.flatMap((memory, index) =>
      getImageReferences(`memories[${index}].src`, memory.src)),
    ...getImageReferences('giftReveal.src', config.giftReveal.src),
  ];
  const uniqueReferences = references.filter(
    (reference, index) =>
      references.findIndex(
        candidate => candidate.publicPath === reference.publicPath,
      ) === index,
  );
  return includeRuntimeAssets
    ? [...uniqueReferences, ...RUNTIME_REFERENCES]
    : uniqueReferences;
}

async function inspectImage(reference, filePath) {
  const extension = extname(reference.publicPath).toLowerCase();
  const expectedFormat = IMAGE_FORMATS.get(extension);
  if (!expectedFormat) return [];

  try {
    const metadata = await sharp(filePath, { failOn: 'error' }).metadata();
    await sharp(filePath, { failOn: 'error' })
      .resize({ width: 1, height: 1, fit: 'inside' })
      .toBuffer();
    const errors = [];
    if (metadata.format !== expectedFormat) {
      errors.push(
        `${reference.field} (${reference.publicPath}) contains ${metadata.format || 'unknown'} data, expected ${expectedFormat}.`,
      );
    }
    if (!metadata.width || !metadata.height) {
      errors.push(
        `${reference.field} (${reference.publicPath}) has invalid image dimensions.`,
      );
    }
    if (
      reference.field.startsWith('memories[') &&
      Math.max(metadata.width || 0, metadata.height || 0) > MAX_MEMORY_EDGE
    ) {
      errors.push(
        `${reference.field} (${reference.publicPath}) exceeds the ${MAX_MEMORY_EDGE}px longest-edge limit.`,
      );
    }
    if (
      metadata.orientation ||
      metadata.exif ||
      metadata.iptc ||
      metadata.xmp ||
      metadata.icc
    ) {
      errors.push(
        `${reference.field} (${reference.publicPath}) contains removable metadata; run npm run optimize.`,
      );
    }
    return errors;
  } catch (error) {
    return [
      `${reference.field} (${reference.publicPath}) is not a decodable ${expectedFormat} image: ${error.message}`,
    ];
  }
}

async function checkMediaFiles(config, publicDir, { includeRuntimeAssets }) {
  const errors = [];
  const files = [];

  for (const reference of getMediaReferences(config, { includeRuntimeAssets })) {
    const filePath = resolve(publicDir, reference.publicPath.slice(1));
    const relativePath = relative(publicDir, filePath);
    if (
      relativePath.startsWith('..')
      || isAbsolute(relativePath)
    ) {
      errors.push(
        `${reference.field} resolves outside the public directory: ${reference.publicPath}.`,
      );
      continue;
    }

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        errors.push(
          `${reference.field} does not reference a file: ${reference.publicPath}.`,
        );
      } else {
        files.push({ ...reference, filePath, size: fileStat.size });
        errors.push(...await inspectImage(reference, filePath));
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        errors.push(
          `${reference.field} references missing media: ${reference.publicPath}.`,
        );
      } else {
        errors.push(
          `${reference.field} could not be inspected (${reference.publicPath}): ${error.message}`,
        );
      }
    }
  }

  return { errors, files };
}

async function checkOrphanedMemoryImages(config, publicDir) {
  const imageDirectory = resolve(publicDir, 'images');
  let entries;
  try {
    entries = await readdir(imageDirectory, { withFileTypes: true });
  } catch (error) {
    return error.code === 'ENOENT'
      ? ['public/images is missing.']
      : [`public/images could not be inspected: ${error.message}`];
  }

  const expected = new Set(
    [...config.memories.map(memory => memory.src), config.giftReveal.src]
      .flatMap(publicPath => {
        const sourceName = publicPath.replace(/^\/images\//, '');
        return [
          sourceName,
          sourceName.replace(/\.(jpe?g|png)$/i, '.webp'),
          sourceName.replace(/\.(jpe?g|png)$/i, '.avif'),
        ];
      }),
  );
  return entries
    .filter(entry => entry.isFile() && IMAGE_FORMATS.has(extname(entry.name).toLowerCase()))
    .filter(entry => !expected.has(entry.name))
    .map(entry => `public/images/${entry.name} is not referenced by gift.json.`);
}

async function sha256(filePath) {
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex');
}

async function checkVariantDigests(config, publicDir) {
  const manifestPath = resolve(publicDir, 'images', VARIANT_MANIFEST);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    return [
      error.code === 'ENOENT'
        ? `public/images/${VARIANT_MANIFEST} is missing; run npm run optimize.`
        : `public/images/${VARIANT_MANIFEST} is invalid: ${error.message}`,
    ];
  }

  if (
    manifest?.version !== 1
    || !manifest.images
    || typeof manifest.images !== 'object'
    || Array.isArray(manifest.images)
  ) {
    return [
      `public/images/${VARIANT_MANIFEST} has an unsupported structure; run npm run optimize.`,
    ];
  }

  const errors = [];
  const expectedSources = new Set();
  const configuredImages = [
    ...config.memories.map((memory, index) => ({
      field: `memories[${index}].src`,
      publicPath: memory.src,
    })),
    {
      field: 'giftReveal.src',
      publicPath: config.giftReveal.src,
    },
  ].filter(
    (image, index, images) =>
      images.findIndex(
        candidate => candidate.publicPath === image.publicPath,
      ) === index,
  );
  for (const image of configuredImages) {
    const sourceName = image.publicPath.replace(/^\/images\//, '');
    const stem = sourceName.replace(/\.jpg$/i, '');
    const entry = manifest.images[sourceName];
    expectedSources.add(sourceName);
    if (!entry || typeof entry !== 'object') {
      errors.push(
        `${image.field} has no digest entry in public/images/${VARIANT_MANIFEST}; run npm run optimize.`,
      );
      continue;
    }

    const paths = {
      source: resolve(publicDir, 'images', sourceName),
      webp: resolve(publicDir, 'images', `${stem}.webp`),
      avif: resolve(publicDir, 'images', `${stem}.avif`),
    };
    for (const [format, filePath] of Object.entries(paths)) {
      let actual;
      try {
        actual = await sha256(filePath);
      } catch {
        continue;
      }
      if (entry[format] !== actual) {
        errors.push(
          `${image.publicPath} has a stale or modified ${format} digest; run npm run optimize.`,
        );
      }
    }
  }

  Object.keys(manifest.images)
    .filter(sourceName => !expectedSources.has(sourceName))
    .forEach(sourceName => {
      errors.push(
        `public/images/${VARIANT_MANIFEST} contains unreferenced source ${sourceName}.`,
      );
    });
  return errors;
}

async function checkShareQr(config, publicDir) {
  if (!config.sharing?.publicUrl) return [];
  try {
    const source = await readFile(resolve(publicDir, 'share-qr.svg'), 'utf8');
    const expectedDigest = createHash('sha256')
      .update(new URL(config.sharing.publicUrl).href)
      .digest('hex');
    return source.includes(`gift-public-url-sha256:${expectedDigest}`)
      ? []
      : ['public/share-qr.svg is stale; run npm run generate:qr.'];
  } catch (error) {
    return error.code === 'ENOENT'
      ? []
      : [`public/share-qr.svg could not be verified: ${error.message}`];
  }
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    printErrors([error.message]);
    process.exitCode = 1;
    return;
  }

  let raw;
  try {
    raw = JSON.parse(await readFile(options.configPath, 'utf8'));
  } catch (error) {
    printErrors([`Could not read valid JSON from ${options.configPath}: ${error.message}`]);
    process.exitCode = 1;
    return;
  }

  const errors = validateGiftConfig(raw);
  if (errors.length > 0) {
    printErrors(errors);
    process.exitCode = 1;
    return;
  }

  const media = await checkMediaFiles(raw, options.publicDir, {
    includeRuntimeAssets: !options.skipRuntimeAssets,
  });
  media.errors.push(...await checkOrphanedMemoryImages(raw, options.publicDir));
  if (!options.skipVariantDigests) {
    media.errors.push(...await checkVariantDigests(raw, options.publicDir));
  }
  if (!options.skipRuntimeAssets) {
    media.errors.push(...await checkShareQr(raw, options.publicDir));
  }
  if (media.errors.length > 0) {
    printErrors(media.errors);
    process.exitCode = 1;
    return;
  }

  printWarnings(getSizeWarnings(media.files));
  console.warn(
    'Privacy preflight: every file and message in this static build will be publicly accessible to anyone with its URL.',
  );
  console.log(
    `Gift validation passed: ${options.configPath} (${media.files.length} media files checked).`,
  );
}

await main();
