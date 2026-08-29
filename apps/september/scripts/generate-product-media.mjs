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
const outputNames = Object.freeze([
  ...productIds.flatMap((id) => [
    `${id}.avif`,
    `${id}.webp`,
    `${id}.jpg`,
  ]),
  "preview.avif",
  "preview.webp",
  "preview.jpg",
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

async function generateOutputs(outputDir) {
  await mkdir(outputDir, { recursive: true });
  await Promise.all(
    productIds.map((id) => encodeAll(productCrop(id, 800, 800), outputDir, id)),
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
