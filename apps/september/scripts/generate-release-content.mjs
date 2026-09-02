#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { SEPTEMBER_ASSET_SOURCES } from "../src/content/assets.mjs";
import { SEPTEMBER_GIFTS } from "../src/content/gifts.mjs";
import { assertSeptemberContent } from "../src/content/schema.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const appRoot = path.resolve(path.dirname(scriptPath), "..");
const publicDir = path.join(appRoot, "public");
const generatedDir = path.join(appRoot, "src", "generated");
const outputNames = Object.freeze([
  "runtime-media.mjs",
  "release-content.json",
  "media-manifest.json",
  "font-manifest.json",
]);
const defaultFileSystem = Object.freeze({ mkdir, rename, rm, writeFile });

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, sortObject(value[key])]),
  );
}

function canonicalJson(value) {
  return `${JSON.stringify(sortObject(value))}\n`;
}

async function fileDigest(filePath) {
  const bytes = await readFile(filePath);
  const metadata = await stat(filePath);
  return { bytes: metadata.size, sha256: sha256(bytes) };
}

async function outputRecord(gift, format, url, publicDirectory) {
  const filePath = path.join(publicDirectory, url.replace(/^\.\/images\//u, "images/"));
  const digest = await fileDigest(filePath);
  const metadata = await sharp(filePath, { failOn: "error" }).metadata();
  return {
    ...digest,
    format,
    url,
    width: metadata.width,
    height: metadata.height,
    mediaQuery: null,
  };
}

async function buildArtifacts({
  release = false,
  gifts: sourceGifts = SEPTEMBER_GIFTS,
  publicDirectory = publicDir,
} = {}) {
  assertSeptemberContent(sourceGifts, { release });
  const gifts = [];
  const mediaAssets = [];

  for (const gift of sourceGifts) {
    const outputs = await Promise.all([
      outputRecord(gift, "avif", gift.media.avifSrc, publicDirectory),
      outputRecord(gift, "webp", gift.media.webpSrc, publicDirectory),
      outputRecord(gift, "jpeg", gift.media.jpegSrc, publicDirectory),
    ]);
    gifts.push({
      id: gift.id,
      groupId: gift.groupId,
      groupLabel: gift.groupLabel,
      clue: gift.clue,
      productName: gift.productName,
      variant: gift.variant,
      reason: gift.reason,
      personalMessage: gift.personalMessage,
      approved: gift.approved,
      fixture: gift.fixture,
      media: {
        assetId: gift.productAssetId,
        avifSrc: gift.media.avifSrc,
        webpSrc: gift.media.webpSrc,
        jpegSrc: gift.media.jpegSrc,
        alt: gift.media.alt,
      },
    });
    mediaAssets.push({
      assetId: gift.productAssetId,
      kind: "product",
      sourcePath: SEPTEMBER_ASSET_SOURCES.products[gift.id].sourcePath,
      provenance: {
        kind: "sender-provided",
        creator: SEPTEMBER_ASSET_SOURCES.products[gift.id].creator,
        pageUrl: SEPTEMBER_ASSET_SOURCES.products[gift.id].pageUrl,
        sourceUrl: SEPTEMBER_ASSET_SOURCES.products[gift.id].sourceUrl,
        licenseUrl: SEPTEMBER_ASSET_SOURCES.products[gift.id].licenseUrl,
      },
      alt: gift.media.alt,
      outputs,
    });
  }

  const fonts = [
    ["playfair-display", "Playfair Display", 600, "normal", "5.2.8"],
    ["playfair-display", "Playfair Display", 700, "normal", "5.2.8"],
    ["playfair-display", "Playfair Display", 600, "italic", "5.2.8"],
    ["be-vietnam-pro", "Be Vietnam Pro", 400, "normal", "5.2.8"],
    ["be-vietnam-pro", "Be Vietnam Pro", 500, "normal", "5.2.8"],
    ["be-vietnam-pro", "Be Vietnam Pro", 600, "normal", "5.2.8"],
    ["be-vietnam-pro", "Be Vietnam Pro", 700, "normal", "5.2.8"],
  ].map(([packageName, family, weight, style, packageVersion]) => ({
    assetId: `${packageName}-${weight}${style === "italic" ? "-italic" : ""}`,
    family,
    style,
    weight,
    packageName: `@fontsource/${packageName}`,
    packageVersion,
    sourcePath: `node_modules/@fontsource/${packageName}`,
    url: `/september/fonts/${packageName}-${weight}${style === "italic" ? "-italic" : ""}.woff2`,
    license: "OFL-1.1",
  }));

  return {
    "runtime-media.mjs": `export const SEPTEMBER_RUNTIME_MEDIA = Object.freeze(${JSON.stringify(sortObject(Object.fromEntries(mediaAssets.map((asset) => [asset.assetId, { alt: asset.alt, outputs: asset.outputs.map(({ url, width, height, mediaQuery }) => ({ url, width, height, mediaQuery })) }]))))});\n`,
    "release-content.json": canonicalJson({
      schemaVersion: 2,
      copyVersion: 3,
      fixtureMode: sourceGifts.some((gift) => gift.fixture === true),
      gifts,
    }),
    "media-manifest.json": canonicalJson({ schemaVersion: 1, assets: mediaAssets }),
    "font-manifest.json": canonicalJson({ schemaVersion: 1, assets: fonts }),
  };
}

export async function publishArtifacts(
  artifacts,
  { destinationDir = generatedDir, fileSystem = defaultFileSystem } = {},
) {
  const temporaryDir = `${destinationDir}.tmp-${process.pid}`;
  const backupDir = `${destinationDir}.backup-${process.pid}`;
  await fileSystem.mkdir(path.dirname(destinationDir), { recursive: true });
  await fileSystem.rm(temporaryDir, { recursive: true, force: true });
  await fileSystem.mkdir(temporaryDir, { recursive: true });

  let destinationMoved = false;
  try {
    for (const name of outputNames) {
      await fileSystem.writeFile(
        path.join(temporaryDir, name),
        artifacts[name],
        "utf8",
      );
    }

    try {
      await fileSystem.rename(destinationDir, backupDir);
      destinationMoved = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    try {
      await fileSystem.rename(temporaryDir, destinationDir);
    } catch (publishError) {
      if (destinationMoved) {
        try {
          await fileSystem.rename(backupDir, destinationDir);
          destinationMoved = false;
        } catch (rollbackError) {
          throw new AggregateError(
            [publishError, rollbackError],
            "September generated content publication and rollback both failed.",
          );
        }
      }
      throw publishError;
    }

    if (destinationMoved) {
      await fileSystem.rm(backupDir, { recursive: true, force: true });
      destinationMoved = false;
    }
  } finally {
    await fileSystem.rm(temporaryDir, { recursive: true, force: true });
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const unknown = [...args].filter((arg) => !["--check", "--release"].includes(arg));
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown.join(" ")}`);
  const artifacts = await buildArtifacts({ release: args.has("--release") });
  const current = {};
  for (const name of outputNames) {
    try {
      current[name] = await readFile(path.join(generatedDir, name), "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      current[name] = null;
    }
  }
  const stale = outputNames.filter((name) => current[name] !== artifacts[name]);
  if (args.has("--check")) {
    if (stale.length > 0) {
      console.error(`September generated content is stale: ${stale.join(", ")}`);
      process.exitCode = 1;
      return;
    }
    console.log("September generated content is fresh.");
    return;
  }
  await publishArtifacts(artifacts);
  console.log(`Generated September release content (${outputNames.length} artifacts).`);
}

if (path.resolve(process.argv[1] ?? "") === scriptPath) await main();

export { buildArtifacts, canonicalJson };
