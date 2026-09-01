import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadExperienceRegistry } from "../../scripts/experience-registry.mjs";

const projectRoot = new URL("../..", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);

test("Vercel and release scripts invoke the cross-platform build gate", async () => {
  const [packageJsonSource, vercelJson] = await Promise.all([
    readFile(new URL("../../package.json", import.meta.url), "utf8"),
    readFile(new URL("../../vercel.json", import.meta.url), "utf8"),
  ]);

  const packageJson = JSON.parse(packageJsonSource);
  assert.equal(packageJson.scripts["build:vercel"], "node scripts/build-vercel.mjs");
  assert.equal(
    packageJson.scripts["build:release"],
    "node scripts/build-vercel.mjs --production",
  );
  assert.equal(
    packageJson.scripts["validate:september:release"],
    "npm --prefix apps/september run validate:release",
  );
  const septemberPackage = JSON.parse(
    await readFile(new URL("../../apps/september/package.json", import.meta.url), "utf8"),
  );
  assert.equal(
    septemberPackage.scripts["generate:manifests"],
    "node scripts/generate-media-manifest.mjs && node scripts/generate-hand-landmarker-assets.mjs && node scripts/generate-release-content.mjs",
  );
  assert.equal(
    septemberPackage.scripts["check:manifests"],
    "node scripts/generate-media-manifest.mjs --check && node scripts/generate-hand-landmarker-assets.mjs --check && node scripts/generate-release-content.mjs --check",
  );
  assert.match(packageJson.scripts.test, /npm run test:september/u);
  assert.equal(JSON.parse(vercelJson).buildCommand, "npm run build:vercel");
});

test("September responses have same-origin camera privacy headers", async () => {
  const config = JSON.parse(
    await readFile(new URL("../../vercel.json", import.meta.url), "utf8"),
  );
  const septemberHeaders = config.headers.find(({ source }) => source === "/september/(.*)");
  assert.ok(septemberHeaders);
  const byKey = new Map(septemberHeaders.headers.map(({ key, value }) => [key, value]));
  assert.equal(byKey.get("Referrer-Policy"), "no-referrer");
  assert.match(byKey.get("Content-Security-Policy") ?? "", /connect-src 'self'/u);
  assert.match(byKey.get("Content-Security-Policy") ?? "", /worker-src 'self' blob:/u);
  assert.match(byKey.get("Content-Security-Policy") ?? "", /img-src 'self' data: blob:/u);
  assert.match(byKey.get("Content-Security-Policy") ?? "", /media-src 'self' blob:/u);
});

test("September gate and composite entry have all clean-checkout dependencies tracked", () => {
  const requiredFiles = [
    "apps/september/scripts/media-validator.mjs",
    "apps/september/scripts/generate-media-manifest.mjs",
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

test("Vercel production builds published routes and retains the draft chooser preview", async () => {
  const records = await loadExperienceRegistry();
  const result = spawnSync("npm", ["run", "build:vercel"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, VERCEL_ENV: "production" },
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const manifest = JSON.parse(
    await readFile(new URL("../../dist/build-manifest.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(
    manifest.routes.map(({ id }) => id),
    ["chooser", ...records.filter(({ status }) => status === "published").map(({ id }) => id)],
  );
  assert.deepEqual(
    manifest.catalog.map(({ id, built }) => [id, built]),
    records.map(({ id, status }) => [id, status === "published"]),
  );
  for (const record of records) {
    assert.ok(manifest.assets.some(({ url }) => url === record.preview.publicPath));
    if (record.status !== "published") {
      assert.equal(
        manifest.assets.some(({ route, url }) =>
          route === record.id || url.startsWith(record.route)),
        false,
      );
    }
  }
});

test("publishing the September fixture fails before Vite", async (t) => {
  const fixtureDir = await mkdtemp(join(tmpdir(), "experience-release-"));
  t.after(() => rm(fixtureDir, { recursive: true, force: true }));
  const records = JSON.parse(
    await readFile(new URL("../../src/content/experiences.json", import.meta.url), "utf8"),
  );
  records.find(({ id }) => id === "september").status = "published";
  const registryPath = join(fixtureDir, "experiences.json");
  await writeFile(registryPath, `${JSON.stringify(records, null, 2)}\n`);

  const result = spawnSync(process.execPath, [
    "scripts/build-vercel.mjs",
    "--production",
    "--registry-url",
    pathToFileURL(registryPath).href,
  ], {
    cwd: projectRootPath,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /September release validation failed with 6 error\(s\):/u);
  assert.equal(
    (output.match(/must set approved:true for release\./gu) ?? []).length,
    2,
  );
  assert.equal(
    (output.match(/is a development fixture and cannot ship\./gu) ?? []).length,
    2,
  );
  assert.equal(
    (output.match(/contains placeholder product content and cannot ship\./gu) ?? []).length,
    2,
  );
  assert.doesNotMatch(output, /vite v\d|built in \d/u);
});
