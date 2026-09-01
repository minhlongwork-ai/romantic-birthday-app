import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { generateProductMedia } from "../scripts/generate-product-media.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(appRoot, "public");
const repositoryRoot = path.resolve(appRoot, "..", "..");

test("the generated Sweet & Bloom product media is complete", async () => {
  for (const id of ["cake", "bouquet"]) {
    for (const extension of ["avif", "webp", "jpg"]) {
      const metadata = await sharp(
        path.join(publicDir, "images", `${id}.${extension}`),
      ).metadata();
      assert.equal(metadata.width, 800);
      assert.equal(metadata.height, 800);
    }
  }
  const preview = await sharp(
    path.join(publicDir, "images", "preview.webp"),
  ).metadata();
  assert.equal(preview.width, 1200);
  assert.equal(preview.height, 630);
});

test("checked-in media is generator-fresh", async () => {
  await generateProductMedia({ check: true });
});

test("the chooser preview and release guide describe the paper-and-brass workshop", async () => {
  const [experienceSource, releaseGuide] = await Promise.all([
    readFile(path.join(repositoryRoot, "src", "content", "experiences.json"), "utf8"),
    readFile(path.join(repositoryRoot, "docs", "release-process.md"), "utf8"),
  ]);
  const september = JSON.parse(experienceSource).find(({ id }) => id === "september");

  assert.match(september.preview.alt, /xưởng nhỏ|phong bì giấy|bàn gỗ/iu);
  assert.doesNotMatch(releaseGuide, /\bNFC\b|NTAG213|#gift=/u);
  assert.match(releaseGuide, /iPhone|camera|Dùng chạm/u);
});

test("the media generator only derives the verified cake and bouquet demo sources", async () => {
  const source = await readFile(
    path.join(appRoot, "scripts", "generate-product-media.mjs"),
    "utf8",
  );

  assert.match(source, /productIds = Object\.freeze\(\["cake", "bouquet"\]\)/u);
  assert.match(source, /`product-\$\{id\}\.jpeg`/u);
  assert.doesNotMatch(source, /sealed-box|product-(?:cleanser|lipstick|moisturizer)/u);
});
