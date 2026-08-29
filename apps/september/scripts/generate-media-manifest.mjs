#!/usr/bin/env node

import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SEPTEMBER_GIFTS } from "../src/content/gifts.mjs";
import { createSeptemberMediaManifest } from "./media-validator.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const appRoot = path.resolve(path.dirname(scriptPath), "..");
const publicDir = path.join(appRoot, "public");
const manifestPath = path.join(appRoot, "src", "content", "media-manifest.json");
const defaultFileSystem = Object.freeze({ mkdir, rename, rm, writeFile });

export async function generateMediaManifestSource() {
  const manifest = await createSeptemberMediaManifest({
    gifts: SEPTEMBER_GIFTS,
    publicDir,
  });
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export async function publishMediaManifest(
  source,
  {
    destinationPath = manifestPath,
    fileSystem = defaultFileSystem,
  } = {},
) {
  const temporaryPath = `${destinationPath}.tmp-${process.pid}`;
  await fileSystem.mkdir(path.dirname(destinationPath), { recursive: true });
  await fileSystem.rm(temporaryPath, { force: true });
  try {
    await fileSystem.writeFile(temporaryPath, source, "utf8");
    await fileSystem.rename(temporaryPath, destinationPath);
  } finally {
    await fileSystem.rm(temporaryPath, { force: true });
  }
}

async function main() {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.some((argument) => argument !== "--check")) {
    throw new Error(`Unknown argument: ${argumentsList.join(" ")}`);
  }

  const source = await generateMediaManifestSource();
  if (argumentsList.includes("--check")) {
    let currentSource = "";
    try {
      currentSource = await readFile(manifestPath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (currentSource !== source) {
      console.error(
        "September media manifest is stale; run npm --prefix apps/september run generate:manifests.",
      );
      process.exitCode = 1;
      return;
    }
    console.log("September media manifest is fresh.");
    return;
  }

  await publishMediaManifest(source);
  console.log(`Wrote ${path.relative(appRoot, manifestPath)}.`);
}

if (path.resolve(process.argv[1] ?? "") === scriptPath) {
  await main();
}
