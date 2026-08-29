import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validatorPath = path.join(appRoot, "scripts", "validate.mjs");

test("the CLI validates two development gifts and reports every release fixture error", () => {
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
  assert.equal(release.status, 1);
  assert.match(release.stderr, /September release validation failed with 6 error\(s\):/u);
  assert.equal((release.stderr.match(/must set approved:true for release\./gu) ?? []).length, 2);
  assert.equal((release.stderr.match(/is a development fixture and cannot ship\./gu) ?? []).length, 2);
  assert.equal((release.stderr.match(/contains placeholder product content and cannot ship\./gu) ?? []).length, 2);
});
