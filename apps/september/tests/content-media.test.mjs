import assert from "node:assert/strict";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { SEPTEMBER_GIFTS } from "../src/content/gifts.mjs";
import {
  createSeptemberMediaManifest,
  MAX_ENCODED_ASSET_BYTES,
  validateSeptemberMedia,
} from "../scripts/media-validator.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(appRoot, "public");
const manifestPath = path.join(appRoot, "src", "content", "media-manifest.json");

async function temporaryPublic(t) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "september-media-"));
  const temporaryPublicDir = path.join(temporaryRoot, "public");
  await cp(path.join(publicDir, "images"), path.join(temporaryPublicDir, "images"), {
    recursive: true,
  });
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  return temporaryPublicDir;
}

test("the Sweet & Bloom product derivatives form one fresh 800x800 media set", async () => {
  const manifest = await createSeptemberMediaManifest({
    gifts: SEPTEMBER_GIFTS,
    publicDir,
  });

  assert.deepEqual(Object.keys(manifest.images).sort(), ["bouquet", "cake"]);
  assert.equal(
    Object.values(manifest.images).flatMap(({ files }) => Object.values(files))
      .length,
    6,
  );
  assert.ok(
    Object.values(manifest.images).every(
      ({ width, height }) => width === 800 && height === 800,
    ),
  );
  assert.deepEqual(
    await validateSeptemberMedia({
      gifts: SEPTEMBER_GIFTS,
      publicDir,
      manifest,
    }),
    [],
  );
});

test("a stale digest or unreferenced manifest entry fails validation", async () => {
  const manifest = await createSeptemberMediaManifest({
    gifts: SEPTEMBER_GIFTS,
    publicDir,
  });
  const stale = structuredClone(manifest);
  stale.images.cake.files.jpeg.sha256 = "0".repeat(64);
  assert.ok(
    (
      await validateSeptemberMedia({
        gifts: SEPTEMBER_GIFTS,
        publicDir,
        manifest: stale,
      })
    ).some((error) => /digest manifest is stale/u.test(error)),
  );

  const unreferenced = structuredClone(manifest);
  unreferenced.images.preview = structuredClone(manifest.images.cake);
  assert.ok(
    (
      await validateSeptemberMedia({
        gifts: SEPTEMBER_GIFTS,
        publicDir,
        manifest: unreferenced,
      })
    ).some((error) => /unreferenced assets/u.test(error)),
  );
});

test("a file with the right extension and signature still must decode", async (t) => {
  const manifest = await createSeptemberMediaManifest({
    gifts: SEPTEMBER_GIFTS,
    publicDir,
  });
  const temporaryPublicDir = await temporaryPublic(t);
  await writeFile(
    path.join(temporaryPublicDir, "images", "cake.jpg"),
    Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]),
  );

  const errors = await validateSeptemberMedia({
    gifts: SEPTEMBER_GIFTS,
    publicDir: temporaryPublicDir,
    manifest,
  });
  assert.ok(errors.some((error) => /not decodable/u.test(error)));
});

test("encoded media bytes must match the declared AVIF, WebP, or JPEG type", async (t) => {
  const manifest = await createSeptemberMediaManifest({
    gifts: SEPTEMBER_GIFTS,
    publicDir,
  });
  const temporaryPublicDir = await temporaryPublic(t);
  await cp(
    path.join(temporaryPublicDir, "images", "cake.jpg"),
    path.join(temporaryPublicDir, "images", "cake.webp"),
  );

  const errors = await validateSeptemberMedia({
    gifts: SEPTEMBER_GIFTS,
    publicDir: temporaryPublicDir,
    manifest,
  });
  assert.ok(errors.some((error) => /MIME signature/u.test(error)));
});

test("the checked-in manifest matches every current product encoding", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.deepEqual(
    await validateSeptemberMedia({
      gifts: SEPTEMBER_GIFTS,
      publicDir,
      manifest,
    }),
    [],
  );
});

test("every configured source and derivative must exist", async (t) => {
  const manifest = await createSeptemberMediaManifest({
    gifts: SEPTEMBER_GIFTS,
    publicDir,
  });
  const temporaryPublicDir = await temporaryPublic(t);
  await unlink(path.join(temporaryPublicDir, "images", "cake.avif"));

  const errors = await validateSeptemberMedia({
    gifts: SEPTEMBER_GIFTS,
    publicDir: temporaryPublicDir,
    manifest,
  });
  assert.ok(
    errors.some((error) =>
      /references missing media.*cake\.avif/u.test(error),
    ),
  );
});

test("all derivatives and both products must keep identical dimensions", async (t) => {
  const manifest = await createSeptemberMediaManifest({
    gifts: SEPTEMBER_GIFTS,
    publicDir,
  });

  const mismatchedDerivativeDir = await temporaryPublic(t);
  const cakeWebpPath = path.join(
    mismatchedDerivativeDir,
    "images",
    "cake.webp",
  );
  await writeFile(
    cakeWebpPath,
    await sharp(cakeWebpPath).resize(640, 800, { fit: "fill" }).webp().toBuffer(),
  );
  const derivativeErrors = await validateSeptemberMedia({
    gifts: SEPTEMBER_GIFTS,
    publicDir: mismatchedDerivativeDir,
    manifest,
  });
  assert.ok(
    derivativeErrors.some((error) =>
      /AVIF, WebP, and JPEG dimensions must match/u.test(error),
    ),
  );

  const mismatchedProductDir = await temporaryPublic(t);
  for (const [extension, encode] of [
    ["avif", (pipeline) => pipeline.avif()],
    ["webp", (pipeline) => pipeline.webp()],
    ["jpg", (pipeline) => pipeline.jpeg()],
  ]) {
    const assetPath = path.join(
      mismatchedProductDir,
      "images",
      `bouquet.${extension}`,
    );
    const pipeline = sharp(assetPath).resize(640, 800, { fit: "fill" });
    await writeFile(assetPath, await encode(pipeline).toBuffer());
  }
  const productErrors = await validateSeptemberMedia({
    gifts: SEPTEMBER_GIFTS,
    publicDir: mismatchedProductDir,
    manifest,
  });
  assert.ok(
    productErrors.some((error) =>
      /identical dimensions and ratio/u.test(error),
    ),
  );
});

test("every encoded product asset is capped at 300 KiB", async (t) => {
  const manifest = await createSeptemberMediaManifest({
    gifts: SEPTEMBER_GIFTS,
    publicDir,
  });
  const temporaryPublicDir = await temporaryPublic(t);
  const oversized = Buffer.alloc(MAX_ENCODED_ASSET_BYTES + 1);
  oversized.set([0xff, 0xd8, 0xff]);
  await writeFile(
    path.join(temporaryPublicDir, "images", "cake.jpg"),
    oversized,
  );

  const errors = await validateSeptemberMedia({
    gifts: SEPTEMBER_GIFTS,
    publicDir: temporaryPublicDir,
    manifest,
  });
  assert.ok(errors.some((error) => /encoded asset limit/u.test(error)));
});
