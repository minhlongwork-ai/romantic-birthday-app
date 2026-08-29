import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import {
  assertSeptemberContent,
  orderedProductMedia,
  validateSeptemberContent,
} from "../src/content/schema.mjs";

export const MAX_ENCODED_ASSET_BYTES = 300 * 1024;

const FORMAT_BY_MIME = Object.freeze({
  "image/avif": "avif",
  "image/webp": "webp",
  "image/jpeg": "jpeg",
});

const SHARP_FORMAT_BY_MEDIA_FORMAT = Object.freeze({
  avif: "heif",
  webp: "webp",
  jpeg: "jpeg",
});

export class SeptemberMediaError extends Error {
  constructor(errors) {
    super(`September media validation failed:\n- ${errors.join("\n- ")}`);
    this.name = "SeptemberMediaError";
    this.errors = errors;
  }
}

function resolvePublicAsset(publicDir, publicPath) {
  const filePath = path.resolve(publicDir, publicPath.replace(/^\.\//u, ""));
  const relativePath = path.relative(publicDir, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${publicPath} resolves outside the public directory.`);
  }
  return filePath;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function hasExpectedSignature(buffer, format) {
  if (format === "jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (format === "webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  if (format === "avif") {
    const header = buffer.subarray(0, Math.min(buffer.length, 64)).toString("ascii");
    return header.includes("ftyp") && /(?:avif|avis)/u.test(header);
  }
  return false;
}

async function inspectAsset({ publicDir, publicPath, format, field }) {
  const filePath = resolvePublicAsset(publicDir, publicPath);
  let fileStats;
  let buffer;
  try {
    [fileStats, buffer] = await Promise.all([
      stat(filePath),
      readFile(filePath),
    ]);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`${field} references missing media: ${publicPath}.`);
    }
    throw new Error(`${field} could not be read (${publicPath}): ${error.message}`);
  }
  if (!fileStats.isFile()) {
    throw new Error(`${field} does not reference a regular file: ${publicPath}.`);
  }
  if (fileStats.size > MAX_ENCODED_ASSET_BYTES) {
    throw new Error(
      `${field} exceeds the ${MAX_ENCODED_ASSET_BYTES}-byte encoded asset limit: ${publicPath}.`,
    );
  }
  if (!hasExpectedSignature(buffer, format)) {
    throw new Error(`${field} has a MIME signature that does not match ${format}.`);
  }

  let metadata;
  try {
    const image = sharp(buffer, { failOn: "error" });
    metadata = await image.metadata();
    await sharp(buffer, { failOn: "error" })
      .resize({ width: 1, height: 1, fit: "inside" })
      .toBuffer();
  } catch (error) {
    throw new Error(
      `${field} is not decodable as ${format}: ${error.message}`,
    );
  }
  if (metadata.format !== SHARP_FORMAT_BY_MEDIA_FORMAT[format]) {
    throw new Error(
      `${field} decodes as ${metadata.format ?? "unknown"}, expected ${format}.`,
    );
  }
  if (!metadata.width || !metadata.height) {
    throw new Error(`${field} has invalid image dimensions.`);
  }

  return {
    path: publicPath,
    sha256: sha256(buffer),
    bytes: fileStats.size,
    width: metadata.width,
    height: metadata.height,
  };
}

async function inspectAllMedia({ gifts, publicDir }) {
  const errors = [];
  const inspected = {};

  for (const gift of gifts) {
    const files = {};
    for (const [index, media] of orderedProductMedia(gift.media).entries()) {
      const format = FORMAT_BY_MIME[media.type];
      try {
        files[format] = await inspectAsset({
          publicDir,
          publicPath: media.src,
          format,
          field: `${gift.id}.media.${["avifSrc", "webpSrc", "jpegSrc"][index]}`,
        });
      } catch (error) {
        errors.push(error.message);
      }
    }

    const completeFiles = Object.values(files);
    if (completeFiles.length === 3) {
      const dimensions = new Set(
        completeFiles.map(({ width, height }) => `${width}x${height}`),
      );
      if (dimensions.size !== 1) {
        errors.push(`${gift.id} AVIF, WebP, and JPEG dimensions must match.`);
      }
      inspected[gift.id] = files;
    }
  }

  const dimensions = new Set(
    Object.values(inspected).flatMap((files) =>
      Object.values(files).map(({ width, height }) => `${width}x${height}`),
    ),
  );
  if (Object.keys(inspected).length === gifts.length && dimensions.size !== 1) {
    errors.push("All September product media must use identical dimensions and ratio.");
  }

  return { errors, inspected };
}

function manifestFromInspected(gifts, inspected) {
  return {
    version: 1,
    images: Object.fromEntries(
      gifts.map((gift) => {
        const files = inspected[gift.id];
        const { width, height } = files.jpeg;
        return [
          gift.id,
          {
            source: gift.media.jpegSrc,
            width,
            height,
            files: Object.fromEntries(
              ["avif", "webp", "jpeg"].map((format) => [
                format,
                {
                  path: files[format].path,
                  sha256: files[format].sha256,
                  bytes: files[format].bytes,
                },
              ]),
            ),
          },
        ];
      }),
    ),
  };
}

export async function createSeptemberMediaManifest({ gifts, publicDir }) {
  assertSeptemberContent(gifts);
  const { errors, inspected } = await inspectAllMedia({ gifts, publicDir });
  if (errors.length > 0) {
    throw new SeptemberMediaError(errors);
  }
  return manifestFromInspected(gifts, inspected);
}

export async function validateSeptemberMedia({ gifts, publicDir, manifest }) {
  const errors = validateSeptemberContent(gifts);
  if (errors.length > 0) return errors;

  const inspectedResult = await inspectAllMedia({ gifts, publicDir });
  errors.push(...inspectedResult.errors);
  if (inspectedResult.errors.length > 0) return errors;

  const expectedManifest = manifestFromInspected(gifts, inspectedResult.inspected);
  if (JSON.stringify(manifest) !== JSON.stringify(expectedManifest)) {
    errors.push(
      "September media digest manifest is stale, malformed, or contains unreferenced assets.",
    );
  }
  return errors;
}
