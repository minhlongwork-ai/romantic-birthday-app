import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("September runtime UI contains no lunar or cosmetic references", async () => {
  const source = await Promise.all([
    readFile(path.join(appRoot, "src", "ui", "scenes.js"), "utf8"),
    readFile(path.join(appRoot, "src", "styles.css"), "utf8"),
    readFile(path.join(appRoot, "src", "content", "copy.mjs"), "utf8"),
  ]).then((parts) => parts.join("\n"));

  assert.doesNotMatch(
    source,
    /Ba Pha Trăng|phase-(?:new|waxing|full)|moon-seal|ambient-moon|cleanser|moisturizer|lipstick/u,
  );
  assert.match(source, /ribbon-puzzle/u);
  assert.match(source, /fallback-silhouette-cake/u);
  assert.match(source, /fallback-silhouette-bouquet/u);
});
