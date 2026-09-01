import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("September runtime UI contains only the paper-and-brass workshop vocabulary", async () => {
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
    /(?:nfc-progress|parseNfc|nfc-dialog|puzzle|ribbon|lunar|moon|nasa|orbit|cosmetic)/iu,
  );
  assert.match(source, /workshop-stage/u);
  assert.match(source, /paper-shadow/u);
});
