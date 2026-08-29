import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("September runtime UI contains no lunar or cosmetic references", async () => {
  const projectRoot = path.resolve(appRoot, "../..");
  const tracked = spawnSync(
    "git",
    ["ls-files", "apps/september/index.html", "apps/september/src"],
    { cwd: projectRoot, encoding: "utf8" },
  );
  assert.equal(tracked.status, 0, tracked.stderr);
  const runtimeFiles = tracked.stdout.trim().split("\n").filter((file) =>
    /\.(?:css|html|js|json|mjs)$/u.test(file),
  );
  const source = await Promise.all(
    runtimeFiles.map((file) => readFile(path.join(projectRoot, file), "utf8")),
  ).then((parts) => parts.join("\n"));

  assert.doesNotMatch(
    source,
    /Ba Pha Trăng|\b(?:lunar|moon|nasa|orbit|phase)(?:[A-Z_-]|\b)|cleanser|moisturizer|lipstick/iu,
  );
  assert.match(source, /ribbon-puzzle/u);
  assert.match(source, /fallback-silhouette-cake/u);
  assert.match(source, /fallback-silhouette-bouquet/u);
});
