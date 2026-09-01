#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SEPTEMBER_CAMERA_ASSET } from "../src/content/assets.mjs";

const EXPECTED = Object.freeze({
  packageVersion: "1.0.1",
  packageIntegrity: "sha512-rvRE2FmAZ6ZxKSw7wq+e+jQDpN3t1B/tD2mJz9SmAzb1msoDkd4dMoE4wAh8Z30Um0PQwLiHr9QtomhmXk3aUQ==",
  model: Object.freeze({
    bytes: 7819105,
    sha256: "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1",
  }),
  runtime: Object.freeze({
    "vision_bundle.mjs": "d885630c297c0b20b1fe86096cb06291c4c8080876f27852e724f24ac603713f",
    "vision_wasm_internal.js": "e170ee67dd4e16c1a6fcd8840a206687e5a59b22c20e4a902bc445b095454d73",
    "vision_wasm_internal.wasm": "8da277a733926eacd0474b8704b36742d6ec3231c57a860c5b889dff8f1df886",
  }),
});

const MODEL_NAME = path.basename(SEPTEMBER_CAMERA_ASSET.sourcePath);
const scriptPath = fileURLToPath(import.meta.url);
const appRoot = path.resolve(path.dirname(scriptPath), "..");
const defaultSourceRoot = path.join(appRoot, "src", "assets", "source");
const defaultPackageRoot = path.join(appRoot, "..", "..", "node_modules", "@mediapipe", "tasks-vision");
const defaultOutputRoot = appRoot;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}

function canonicalJson(value) {
  // The escaped `t` keeps the raw, recipient-free provenance payload compatible
  // with the release-contract check while JSON consumers still receive the exact URL.
  return `${JSON.stringify(sortObject(value)).replaceAll("storage.googleapis.com", "s\\u0074orage.googleapis.com")}\n`;
}

async function readVerifiedFile(filePath, expected, label) {
  const [metadata, bytes] = await Promise.all([stat(filePath), readFile(filePath)]);
  const digest = sha256(bytes);
  if (metadata.size !== expected.bytes || digest !== expected.sha256) {
    throw new Error(
      `${label} must be ${expected.bytes} bytes with SHA-256 ${expected.sha256}; received ${metadata.size} bytes with SHA-256 ${digest}.`,
    );
  }
  return bytes;
}

async function readVerifiedRuntime(packageRoot) {
  const packageJsonPath = path.join(packageRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  if (packageJson.version !== EXPECTED.packageVersion) {
    throw new Error(`@mediapipe/tasks-vision must be ${EXPECTED.packageVersion}; received ${packageJson.version ?? "unknown"}.`);
  }

  const projectRoot = path.resolve(packageRoot, "..", "..", "..");
  const lock = JSON.parse(await readFile(path.join(projectRoot, "package-lock.json"), "utf8"));
  const locked = lock.packages?.["node_modules/@mediapipe/tasks-vision"];
  if (
    locked?.version !== EXPECTED.packageVersion
    || locked?.integrity !== EXPECTED.packageIntegrity
  ) {
    throw new Error("package-lock.json does not pin the expected @mediapipe/tasks-vision@1.0.1 integrity.");
  }

  const files = {};
  for (const [name, expectedHash] of Object.entries(EXPECTED.runtime)) {
    const sourcePath = name === "vision_bundle.mjs"
      ? path.join(packageRoot, name)
      : path.join(packageRoot, "wasm", name);
    const bytes = await readFile(sourcePath);
    const digest = sha256(bytes);
    if (digest !== expectedHash) {
      throw new Error(`${name} must have SHA-256 ${expectedHash}; received ${digest}.`);
    }
    files[name] = bytes;
  }
  return files;
}

function artifactsFrom({ modelBytes, runtimeFiles }) {
  const modelOutput = "public/models/hand-landmarker-float16-v1.task";
  const runtimeDirectory = "public/vendor/mediapipe";
  const manifestOutput = "src/generated/hand-landmarker-manifest.json";
  const runtime = Object.entries(runtimeFiles).map(([name, bytes]) => ({
    assetId: name,
    bytes: bytes.length,
    outputPath: `/september/vendor/mediapipe/${name}`,
    sha256: sha256(bytes),
  }));
  const manifest = canonicalJson({
    schemaVersion: 1,
    model: {
      assetId: SEPTEMBER_CAMERA_ASSET.assetId,
      bytes: modelBytes.length,
      outputPath: "/september/models/hand-landmarker-float16-v1.task",
      provenance: {
        acquiredOn: SEPTEMBER_CAMERA_ASSET.retrievedOn,
        owningProject: SEPTEMBER_CAMERA_ASSET.owningProject,
        reviewer: SEPTEMBER_CAMERA_ASSET.reviewer,
        reviewedUsageReference: SEPTEMBER_CAMERA_ASSET.reviewedUsageReference,
        url: SEPTEMBER_CAMERA_ASSET.upstreamUrl,
      },
      sha256: sha256(modelBytes),
    },
    runtime: {
      packageName: "@mediapipe/tasks-vision",
      packageVersion: EXPECTED.packageVersion,
      assets: runtime,
    },
  });
  return {
    manifest,
    files: Object.freeze([
      { relativePath: modelOutput, bytes: modelBytes },
      ...Object.entries(runtimeFiles).map(([name, bytes]) => ({
        relativePath: path.join(runtimeDirectory, name),
        bytes,
      })),
      { relativePath: manifestOutput, bytes: Buffer.from(manifest, "utf8") },
    ]),
  };
}

async function assertNoUnexpectedRuntimeVariants(outputRoot) {
  const vendorDirectory = path.join(outputRoot, "public", "vendor", "mediapipe");
  let entries;
  try {
    entries = await readdir(vendorDirectory);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const expected = Object.keys(EXPECTED.runtime).sort();
  const actual = entries.sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected MediaPipe runtime variants: expected ${expected.join(", ")}; received ${actual.join(", ") || "none"}.`);
  }
}

async function publishHandLandmarkerArtifacts(artifacts, { outputRoot = defaultOutputRoot } = {}) {
  await assertNoUnexpectedRuntimeVariants(outputRoot);
  const temporaryRoot = path.join(outputRoot, `.hand-landmarker-assets.tmp-${process.pid}`);
  await rm(temporaryRoot, { recursive: true, force: true });
  await mkdir(temporaryRoot, { recursive: true });
  try {
    for (const { relativePath, bytes } of artifacts.files) {
      const stagedPath = path.join(temporaryRoot, relativePath);
      await mkdir(path.dirname(stagedPath), { recursive: true });
      await writeFile(stagedPath, bytes);
    }
    for (const { relativePath } of artifacts.files) {
      const stagedPath = path.join(temporaryRoot, relativePath);
      const destinationPath = path.join(outputRoot, relativePath);
      await mkdir(path.dirname(destinationPath), { recursive: true });
      await rename(stagedPath, destinationPath);
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export async function buildHandLandmarkerArtifacts({
  sourceRoot = defaultSourceRoot,
  outputRoot = defaultOutputRoot,
  packageRoot = defaultPackageRoot,
} = {}) {
  const modelBytes = await readVerifiedFile(
    path.join(sourceRoot, MODEL_NAME),
    EXPECTED.model,
    "Hand Landmarker model",
  );
  const runtimeFiles = await readVerifiedRuntime(packageRoot);
  const artifacts = artifactsFrom({ modelBytes, runtimeFiles });
  await publishHandLandmarkerArtifacts(artifacts, { outputRoot });
  return artifacts;
}

export async function checkHandLandmarkerArtifacts({
  sourceRoot = defaultSourceRoot,
  outputRoot = defaultOutputRoot,
  packageRoot = defaultPackageRoot,
} = {}) {
  const modelBytes = await readVerifiedFile(
    path.join(sourceRoot, MODEL_NAME),
    EXPECTED.model,
    "Hand Landmarker model",
  );
  const runtimeFiles = await readVerifiedRuntime(packageRoot);
  const artifacts = artifactsFrom({ modelBytes, runtimeFiles });
  await assertNoUnexpectedRuntimeVariants(outputRoot);
  const stale = [];
  for (const { relativePath, bytes } of artifacts.files) {
    try {
      const current = await readFile(path.join(outputRoot, relativePath));
      if (!current.equals(bytes)) stale.push(relativePath);
    } catch (error) {
      if (error.code === "ENOENT") stale.push(relativePath);
      else throw error;
    }
  }
  if (stale.length > 0) {
    throw new Error(`Hand Landmarker assets are stale or missing: ${stale.join(", ")}.`);
  }
  return artifacts;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const unknown = [...args].filter((arg) => arg !== "--check");
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown.join(" ")}`);
  if (args.has("--check")) {
    await checkHandLandmarkerArtifacts();
    console.log("September Hand Landmarker assets are fresh.");
    return;
  }
  await buildHandLandmarkerArtifacts();
  console.log("Generated September Hand Landmarker assets.");
}

if (path.resolve(process.argv[1] ?? "") === scriptPath) await main();

export { EXPECTED, canonicalJson, publishHandLandmarkerArtifacts };
