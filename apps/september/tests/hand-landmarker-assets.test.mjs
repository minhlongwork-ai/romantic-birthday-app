import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildHandLandmarkerArtifacts } from "../scripts/generate-hand-landmarker-assets.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFixture = path.join(
  appRoot,
  "src",
  "assets",
  "source",
  "hand-landmarker-float16-v1.task",
);
const packageRoot = path.join(appRoot, "..", "..", "node_modules", "@mediapipe", "tasks-vision");

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "september-hand-landmarker-"));
  const sourceRoot = path.join(root, "source");
  const outputRoot = path.join(root, "output");
  await cp(path.dirname(sourceFixture), sourceRoot, { recursive: true });
  t.after(() => rm(root, { recursive: true, force: true }));
  return { sourceRoot, outputRoot };
}

test("camera asset generation rejects a changed model digest before publishing", async (t) => {
  const { sourceRoot, outputRoot } = await fixture(t);
  await writeFile(path.join(sourceRoot, "hand-landmarker-float16-v1.task"), "changed");

  await assert.rejects(
    buildHandLandmarkerArtifacts({ sourceRoot, outputRoot, packageRoot }),
    /fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1/u,
  );
  await assert.rejects(readFile(path.join(outputRoot, "hand-landmarker-manifest.json")), {
    code: "ENOENT",
  });
});

test("generated provenance is canonical and contains no recipient data", async (t) => {
  const { sourceRoot, outputRoot } = await fixture(t);
  const artifacts = await buildHandLandmarkerArtifacts({ sourceRoot, outputRoot, packageRoot });

  assert.match(artifacts.manifest, /"schemaVersion":1/u);
  assert.doesNotMatch(artifacts.manifest, /(?:to|from|recipient|sender|query)/iu);
  assert.equal(JSON.parse(artifacts.manifest).schemaVersion, 1);
});
