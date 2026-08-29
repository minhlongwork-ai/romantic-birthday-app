import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../..", import.meta.url);

test("Vercel invokes the environment-aware build gate from tracked sources", async () => {
  const [packageJsonSource, vercelJson, buildGate] = await Promise.all([
    readFile(new URL("../../package.json", import.meta.url), "utf8"),
    readFile(new URL("../../vercel.json", import.meta.url), "utf8"),
    readFile(new URL("../../scripts/build-vercel.mjs", import.meta.url), "utf8"),
  ]);

  const packageJson = JSON.parse(packageJsonSource);
  assert.equal(packageJson.scripts["build:vercel"], "node scripts/build-vercel.mjs");
  assert.equal(
    packageJson.scripts["build:release"],
    "npm run validate:september:release && npm run build",
  );
  assert.equal(
    packageJson.scripts["validate:september:release"],
    "npm --prefix apps/september run validate:release",
  );
  assert.match(packageJson.scripts.test, /npm run test:september/u);
  assert.equal(JSON.parse(vercelJson).buildCommand, "npm run build:vercel");
  assert.match(buildGate, /VERCEL_ENV === "production"/u);
  assert.match(
    buildGate,
    /apps\/september\/scripts\/validate\.mjs", "--release"/u,
  );
  assert.match(buildGate, /scripts\/build-composite\.mjs/u);
});

test("September gate and composite entry have all clean-checkout dependencies tracked", () => {
  const requiredFiles = [
    "apps/september/scripts/media-validator.mjs",
    "apps/september/index.html",
    "apps/september/vite.config.js",
    "apps/september/src/core/personalization.mjs",
    "apps/september/src/ui/dom.js",
    "apps/september/src/assets/source/background-warm-silk.jpeg",
    "apps/september/public/images/background-desktop.jpg",
    "apps/september/public/images/background-mobile.jpg",
  ];
  const result = spawnSync("git", ["ls-files", "--error-unmatch", ...requiredFiles], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split("\n"), [...requiredFiles].sort());
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
