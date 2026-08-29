import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../..", import.meta.url);

test("Vercel invokes the environment-aware build gate from tracked sources", async () => {
  const [packageJson, vercelJson, buildGate] = await Promise.all([
    readFile(new URL("../../package.json", import.meta.url), "utf8"),
    readFile(new URL("../../vercel.json", import.meta.url), "utf8"),
    readFile(new URL("../../scripts/build-vercel.mjs", import.meta.url), "utf8"),
  ]);

  assert.equal(JSON.parse(packageJson).scripts["build:vercel"], "node scripts/build-vercel.mjs");
  assert.equal(JSON.parse(vercelJson).buildCommand, "npm run build:vercel");
  assert.match(buildGate, /VERCEL_ENV === "production"/u);
  assert.match(
    buildGate,
    /apps\/september\/scripts\/validate\.mjs", "--release"/u,
  );
  assert.match(buildGate, /scripts\/build-composite\.mjs/u);
});

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
