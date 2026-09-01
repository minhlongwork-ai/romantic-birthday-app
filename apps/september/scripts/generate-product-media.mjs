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

function workshopPreviewOverlay() {
  return Buffer.from(`
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="#291c17" opacity="0.46"/>
      <rect y="365" width="1200" height="265" fill="#5e3828" opacity="0.72"/>
      <g stroke="#c5966f" stroke-width="3" opacity="0.2">
        <path d="M0 410H1200M0 475H1200M0 545H1200M0 603H1200"/>
      </g>
      <ellipse cx="600" cy="501" rx="350" ry="55" fill="#1e130f" opacity="0.35"/>
      <g transform="translate(355 145)">
        <path d="M15 72 245 0l230 72v276H15Z" fill="#d8c1a0"/>
        <path d="M15 72 245 248 475 72" fill="#f2dfbd"/>
        <path d="m15 348 174-178 56 78 56-78 174 178" fill="#cba780"/>
        <path d="m15 72 230 176L475 72" fill="none" stroke="#8c654c" stroke-width="7" stroke-linejoin="round"/>
        <circle cx="245" cy="248" r="31" fill="#b5884b"/>
        <circle cx="245" cy="248" r="19" fill="none" stroke="#f0d39b" stroke-width="4"/>
      </g>
      <g fill="#d7b57a" opacity="0.9">
        <path d="M950 135h72l26 145h-124Z"/>
        <path d="M984 95h7v42h-7z"/>
      </g>
      <circle cx="987" cy="125" r="73" fill="#efc77b" opacity="0.17"/>
      <path d="M142 495c44-42 115-46 171-9l-29 44c-37-24-85-20-112 7Z" fill="#f2e4cc" opacity="0.72"/>
    </svg>
  `);
}

async function generateOutputs(outputDir) {
  await mkdir(outputDir, { recursive: true });
  await Promise.all(
    productIds.map((id) => encodeAll(productCrop(id, 800, 800), outputDir, id)),
  );

  const preview = sharp(path.join(sourceDir, "background-warm-silk.jpeg"))
    .rotate()
    .resize(1200, 630, { fit: "cover", position: "attention" })
    .modulate({ brightness: 0.64, saturation: 0.7 })
    .composite([{ input: workshopPreviewOverlay(), top: 0, left: 0 }]);
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
