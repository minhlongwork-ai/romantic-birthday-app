import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDownscaledSize,
  calculatePhotoTransform,
  disposePhoto,
  MAX_PHOTO_BYTES,
  PhotoValidationError,
  normalizePhotoFormat,
  validatePhoto,
} from "../src/herbarium/photo-engine.js";

test("validates a JPEG selected from the device", () => {
  const metadata = validatePhoto({
    name: "bouquet.JPG",
    type: "image/jpeg",
    size: 2_048,
  });

  assert.deepEqual(metadata, {
    name: "bouquet.JPG",
    size: 2_048,
    format: "jpeg",
    mimeType: "image/jpeg",
    extension: "jpg",
    requiresDecodeCheck: false,
  });
});

test("normalizes mobile image formats without trusting an arbitrary extension", () => {
  assert.deepEqual(
    normalizePhotoFormat({
      name: "portrait.HEIC",
      type: "application/octet-stream",
    }),
    {
      format: "heic",
      mimeType: "image/heic",
      extension: "heic",
      requiresDecodeCheck: true,
    },
  );

  assert.deepEqual(
    normalizePhotoFormat({
      name: "portrait.bin",
      type: "image/webp",
    }),
    {
      format: "webp",
      mimeType: "image/webp",
      extension: "bin",
      requiresDecodeCheck: false,
    },
  );

  assert.equal(
    normalizePhotoFormat({
      name: "portrait.jpg",
      type: "application/pdf",
    }),
    null,
  );
});

test("rejects empty, oversized, and unsupported files with stable error codes", () => {
  const cases = [
    [{ name: "empty.jpg", type: "image/jpeg", size: 0 }, "empty-file"],
    [
      {
        name: "huge.jpg",
        type: "image/jpeg",
        size: MAX_PHOTO_BYTES + 1,
      },
      "file-too-large",
    ],
    [
      { name: "notes.pdf", type: "application/pdf", size: 1_024 },
      "unsupported-format",
    ],
  ];

  for (const [file, expectedCode] of cases) {
    assert.throws(
      () => validatePhoto(file),
      (error) =>
        error instanceof PhotoValidationError && error.code === expectedCode,
    );
  }

  assert.equal(
    validatePhoto({
      name: "at-limit.png",
      type: "image/png",
      size: MAX_PHOTO_BYTES,
    }).size,
    MAX_PHOTO_BYTES,
  );
});

test("downscale dimensions preserve aspect ratio and never upscale", () => {
  assert.deepEqual(calculateDownscaledSize(4032, 3024, 2048), {
    width: 2048,
    height: 1536,
    downscaled: true,
  });
  assert.deepEqual(calculateDownscaledSize(3000, 4000, 2048), {
    width: 1536,
    height: 2048,
    downscaled: true,
  });
  assert.deepEqual(calculateDownscaledSize(1200, 900, 2048), {
    width: 1200,
    height: 900,
    downscaled: false,
  });
});

test("crop math covers the frame and clamps zoom, pan, and rotation", () => {
  const centered = calculatePhotoTransform(
    { width: 4_000, height: 3_000 },
    { width: 400, height: 500 },
  );

  assert.equal(centered.zoom, 1);
  assert.equal(centered.rotation, 0);
  assert.ok(Math.abs(centered.renderHeight - 500) < 0.001);
  assert.ok(Math.abs(centered.x + 133.333333) < 0.001);
  assert.equal(centered.y, 0);

  const clamped = calculatePhotoTransform(
    { width: 4_000, height: 3_000 },
    { width: 400, height: 500 },
    { zoom: 9, x: 4, y: -4, rotation: 12 },
  );

  assert.equal(clamped.zoom, 2.5);
  assert.equal(clamped.rotation, 0);
  assert.ok(Math.abs(clamped.x + 577.333333) < 0.001);
  assert.equal(clamped.y, -445);
});

test("photo disposal is idempotent", () => {
  let disposeCount = 0;
  const photo = {
    dispose() {
      disposeCount += 1;
    },
  };

  disposePhoto(photo);
  disposePhoto(photo);

  assert.equal(disposeCount, 1);
});
