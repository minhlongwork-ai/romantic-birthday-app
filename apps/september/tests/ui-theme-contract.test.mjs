import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("September runtime UI is a direct letter with no gift-opening or game flow", async () => {
  const projectRoot = path.resolve(appRoot, "../..");
  const runtimeFiles = [
    "apps/september/index.html",
    "apps/september/src/main.js",
    "apps/september/src/ui/scenes.js",
    "apps/september/src/ui/dom.js",
    "apps/september/src/content/copy.mjs",
  ];
  const source = await Promise.all(
    runtimeFiles.map((file) => readFile(path.join(projectRoot, file), "utf8")),
  ).then((parts) => parts.join("\n"));

  assert.doesNotMatch(
    source,
    /Ba Pha Trăng|\b(?:lunar|moon|nasa|orbit|phase)(?:[A-Z_-]|\b)|cleanser|moisturizer|lipstick/iu,
  );
  assert.match(source, /scene-letter/u);
  assert.match(source, /letter-gift/u);
  assert.doesNotMatch(source, /garden-canvas|blind-box|nfc-progress|puzzle-controller|mountGame|mountReveal/u);
  assert.match(source, /playfair-display/u);
  assert.match(source, /be-vietnam-pro/u);
  assert.match(source, /product-fallback-\$\{gift\.id\}/u);
  assert.match(source, /fallback-silhouette-\$\{gift\.id\}/u);
});

test("September loads range-aware font stylesheets for mixed Vietnamese text", async () => {
  const main = await readFile(path.join(appRoot, "src/main.js"), "utf8");

  assert.match(main, /@fontsource\/playfair-display\/600\.css/u);
  assert.match(main, /@fontsource\/playfair-display\/700\.css/u);
  assert.match(main, /@fontsource\/playfair-display\/600-italic\.css/u);
  assert.match(main, /@fontsource\/be-vietnam-pro\/400\.css/u);
  assert.match(main, /@fontsource\/be-vietnam-pro\/700\.css/u);
  assert.doesNotMatch(main, /@fontsource\/(?:playfair-display|be-vietnam-pro)\/vietnamese-/u);
});
