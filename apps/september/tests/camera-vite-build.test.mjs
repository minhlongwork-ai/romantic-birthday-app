import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "vite";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cameraSessionUrl = pathToFileURL(path.join(appRoot, "src", "core", "camera-session.mjs")).href;
const workerSourcePath = path.join(appRoot, "src", "workers", "hand-landmarker.worker.js");

async function allFiles(root, relative = "") {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const entryPath = path.join(relative, entry.name);
    return entry.isDirectory() ? allFiles(root, entryPath) : [entryPath];
  }));
  return files.flat();
}

test("Vite emits the default module worker and keeps its runtime paths same-origin", async (t) => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "september-camera-vite-"));
  const outDir = path.join(fixtureRoot, "dist");
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));

  await writeFile(
    path.join(fixtureRoot, "entry.js"),
    `import { createCameraSession } from ${JSON.stringify(cameraSessionUrl)};\nwindow.createCameraSession = createCameraSession;\n`,
  );
  await build({
    root: fixtureRoot,
    base: "/september/",
    publicDir: false,
    build: {
      emptyOutDir: true,
      manifest: true,
      outDir,
      rollupOptions: { input: path.join(fixtureRoot, "entry.js") },
    },
  });

  const manifest = JSON.parse(await readFile(path.join(outDir, ".vite", "manifest.json"), "utf8"));
  assert.ok(Object.values(manifest).some(entry => entry.isEntry));
  const files = await allFiles(outDir);
  const workerPath = files.find(file => /hand-landmarker\.worker-[\w-]+\.js$/u.test(file));
  assert.ok(workerPath, "the default module Worker must be emitted as an asset");
  const worker = await readFile(path.join(outDir, workerPath), "utf8");
  const workerSource = await readFile(workerSourcePath, "utf8");
  assert.match(worker, /\/september\/vendor\/mediapipe\/vision_bundle\.mjs/u);
  assert.match(workerSource, /@vite-ignore/u);
  assert.match(worker, /\/september\/models\/hand-landmarker-float16-v1\.task/u);
  assert.doesNotMatch(worker, /landmarks\s*:/u);

  for (const file of files.filter(file => file.endsWith(".js"))) {
    const source = await readFile(path.join(outDir, file), "utf8");
    assert.doesNotMatch(source, /https?:\/\//u, `${file} must not introduce a third-party runtime URL`);
  }
});
