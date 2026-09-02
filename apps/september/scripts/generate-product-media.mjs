#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const scriptPath = fileURLToPath(import.meta.url);
const appRoot = path.resolve(path.dirname(scriptPath), "..");
const sourceDir = path.join(appRoot, "src", "assets", "source");
const publicImagesDir = path.join(appRoot, "public", "images");
const productIds = Object.freeze(["cake", "bouquet"]);
const gardenBloomSources = Object.freeze([
  ["cream-rose", "product-bouquet.jpeg", "southwest"],
  ["blush-rose", "product-bouquet.jpeg", "north"],
  ["white-sprig", "product-bouquet.jpeg", "south"],
  ["green-leaf", "garden-leaves.jpeg", "attention"],
  ["champagne-bloom", "product-bouquet.jpeg", "center"],
]);
const outputNames = Object.freeze([
  ...productIds.flatMap((id) => [
    `${id}.avif`,
    `${id}.webp`,
    `${id}.jpg`,
  ]),
  "preview.avif",
  "preview.webp",
  "preview.jpg",
  ...productIds.flatMap((id) => [
    `seal-${id}.avif`,
    `seal-${id}.webp`,
    `seal-${id}.jpg`,
  ]),
  "garden-stage.avif",
  "garden-stage.webp",
  "garden-stage.jpg",
  ...gardenBloomSources.flatMap(([id]) => [
    `garden-bloom-${id}.avif`,
    `garden-bloom-${id}.webp`,
    `garden-bloom-${id}.jpg`,
  ]),
]);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function encodeAll(image, outputDir, baseName) {
  await Promise.all([
    image.clone().avif({ quality: 50 }).toFile(path.join(outputDir, `${baseName}.avif`)),
    image.clone().webp({ quality: 76 }).toFile(path.join(outputDir, `${baseName}.webp`)),
    image.clone().jpeg({ progressive: true, quality: 82 }).toFile(path.join(outputDir, `${baseName}.jpg`)),
  ]);
}

function productCrop(id, width, height) {
  return sharp(path.join(sourceDir, `product-${id}.jpeg`))
    .rotate()
    .resize(width, height, { fit: "cover", position: "attention" });
}

async function roundedPhotoCard(input, width, height, radius = 34) {
  const photograph = await sharp(input)
    .resize(width, height, { fit: "cover", position: "attention" })
    .png()
    .toBuffer();
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/></svg>`,
  );
  const clipped = await sharp(photograph)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  const frame = Buffer.from(
    `<svg width="${width + 18}" height="${height + 18}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${width + 18}" height="${height + 18}" rx="${radius + 9}" fill="#f8f0e8"/></svg>`,
  );
  return sharp({
    create: {
      width: width + 18,
      height: height + 18,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: frame }, { input: clipped, left: 9, top: 9 }])
    .png()
    .toBuffer();
}

async function generateOutputs(outputDir) {
  await mkdir(outputDir, { recursive: true });
  await Promise.all(
    productIds.map((id) => encodeAll(productCrop(id, 800, 800), outputDir, id)),
  );
  await Promise.all(
    productIds.map((id) =>
      encodeAll(productCrop(id, 520, 520), outputDir, `seal-${id}`),
    ),
  );

  const [cake, bouquet] = await Promise.all(
    productIds.map((id) => productCrop(id, 430, 430).png().toBuffer()),
  );
  const preview = sharp(path.join(sourceDir, "background-warm-silk.jpeg"))
    .rotate()
    .resize(1200, 630, { fit: "cover", position: "attention" })
    .modulate({ brightness: 0.58 })
    .composite([
      { input: cake, left: 95, top: 100 },
      { input: bouquet, left: 675, top: 100 },
    ]);
  await encodeAll(preview, outputDir, "preview");

  const gardenCake = await roundedPhotoCard(
    path.join(sourceDir, "product-cake.jpeg"),
    400,
    360,
  );
  const gardenStage = sharp(path.join(sourceDir, "product-bouquet.jpeg"))
    .rotate()
    .resize(1200, 900, { fit: "cover", position: "attention" })
    .modulate({ brightness: 0.72, saturation: 0.78 })
    .composite([
      { input: gardenCake, left: 700, top: 445, blend: "over" },
    ]);
  await encodeAll(gardenStage, outputDir, "garden-stage");

  await Promise.all(
    gardenBloomSources.map(([id, sourceFile, position]) =>
      encodeAll(
        sharp(path.join(sourceDir, sourceFile))
          .rotate()
          .resize(360, 360, { fit: "cover", position }),
        outputDir,
        `garden-bloom-${id}`,
      ),
    ),
  );
}

async function staleOutputs(generatedDir) {
  const stale = [];
  for (const name of outputNames) {
    try {
      const [generated, checkedIn] = await Promise.all([
        readFile(path.join(generatedDir, name)),
        readFile(path.join(publicImagesDir, name)),
      ]);
      if (sha256(generated) !== sha256(checkedIn)) stale.push(name);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      stale.push(name);
    }
  }
  return stale;
}

export async function generateProductMedia({ check = false } = {}) {
  if (!check) {
    await generateOutputs(publicImagesDir);
    return;
  }

  const temporaryDir = await mkdtemp(path.join(os.tmpdir(), "september-media-check-"));
  try {
    await generateOutputs(temporaryDir);
    const stale = await staleOutputs(temporaryDir);
    if (stale.length > 0) {
      throw new Error(`September product media is stale: ${stale.join(", ")}.`);
    }
  } finally {
    await rm(temporaryDir, { recursive: true, force: true });
  }
}

async function main() {
  const argumentsList = process.argv.slice(2);
  const unknown = argumentsList.filter((argument) => argument !== "--check");
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown.join(" ")}`);

  const check = argumentsList.includes("--check");
  await generateProductMedia({ check });
  console.log(
    check
      ? "September product media is fresh."
      : `Generated ${outputNames.length} September media files.`,
  );
}

if (path.resolve(process.argv[1] ?? "") === scriptPath) await main();
