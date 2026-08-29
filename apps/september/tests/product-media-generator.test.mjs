import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { generateProductMedia } from "../scripts/generate-product-media.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(appRoot, "public");

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
