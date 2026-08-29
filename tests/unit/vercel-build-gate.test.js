import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const projectRoot = new URL("../..", import.meta.url);

test("Vercel production blocks the unapproved September fixture before building", () => {
  const result = spawnSync(process.execPath, ["scripts/build-vercel.mjs"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, VERCEL_ENV: "production" },
  });

  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /approved:true/u);
  assert.match(`${result.stdout}\n${result.stderr}`, /development fixture/u);
  assert.equal(
    (`${result.stdout}\n${result.stderr}`.match(/development fixture/gu) ?? []).length,
    2,
  );
  assert.doesNotMatch(result.stdout, /vite v/u);
});
