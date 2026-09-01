import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the DOM renderer emits AVIF, WebP, then JPEG fallback", async () => {
  const source = await readFile(path.join(appRoot, "src", "ui", "dom.js"), "utf8");
  const avifIndex = source.indexOf("gift.media.avifSrc");
  const webpIndex = source.indexOf("gift.media.webpSrc");
  const jpegIndex = source.indexOf("gift.media.jpegSrc");

  assert.ok(avifIndex >= 0, "AVIF source is missing from pictureForGift");
  assert.ok(webpIndex > avifIndex, "WebP must follow AVIF");
  assert.ok(jpegIndex > webpIndex, "JPEG fallback must follow WebP");
  assert.match(source, /picture\.append\(avif, webp, image, fallback\)/u);
});

test("product cards are mounted only by the envelope reveal path", async () => {
  const source = await readFile(path.join(appRoot, "src", "ui", "scenes.js"), "utf8");
  const revealStart = source.indexOf("export function mountReveal");
  const productCard = source.indexOf("data-product-card");

  assert.ok(revealStart >= 0, "mountReveal is missing");
  assert.ok(productCard > revealStart, "a product card must not be created before reveal activation");
  assert.doesNotMatch(source.slice(0, revealStart), /productName|media\.alt|product-message/u);
});
