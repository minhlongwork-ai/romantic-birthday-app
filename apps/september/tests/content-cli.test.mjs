import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validatorPath = path.join(appRoot, "scripts", "validate.mjs");

test("the CLI validates the approved September gifts for development and release", () => {
  const development = spawnSync(process.execPath, [validatorPath], {
    encoding: "utf8",
  });
  assert.equal(development.status, 0, development.stderr);
  assert.match(
    development.stdout,
    /September development validation passed: 2 gifts and 6 product encodings checked\./u,
  );

  const release = spawnSync(process.execPath, [validatorPath, "--release"], {
    encoding: "utf8",
  });
  assert.equal(release.status, 0, release.stderr);
  assert.match(
    release.stdout,
    /September release validation passed: 2 gifts and 6 product encodings checked\./u,
  );
});
