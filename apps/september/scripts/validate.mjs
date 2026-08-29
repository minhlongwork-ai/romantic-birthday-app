#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SEPTEMBER_GIFTS } from "../src/content/gifts.mjs";
import { validateSeptemberContent } from "../src/content/schema.mjs";
import { validateSeptemberMedia } from "./media-validator.mjs";
import { buildArtifacts } from "./generate-release-content.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const appRoot = path.resolve(path.dirname(scriptPath), "..");
const defaultPublicDir = path.join(appRoot, "public");
const defaultManifestPath = path.join(
  appRoot,
  "src",
  "content",
  "media-manifest.json",
);
const generatedDir = path.join(appRoot, "src", "generated");
const generatedNames = [
  "runtime-media.mjs",
  "release-content.json",
  "media-manifest.json",
  "font-manifest.json",
];

async function loadManifest(manifestPath) {
  try {
    return {
      manifest: JSON.parse(await readFile(manifestPath, "utf8")),
      errors: [],
    };
  } catch (error) {
    return {
      manifest: null,
      errors: [
        `Could not read a valid September media manifest at ${manifestPath}: ${error.message}`,
      ],
    };
  }
}

async function validateGeneratedArtifacts() {
  const expected = await buildArtifacts();
  const errors = [];
  for (const name of generatedNames) {
    const filePath = path.join(generatedDir, name);
    try {
      const current = await readFile(filePath, "utf8");
      if (current !== expected[name]) errors.push(`Generated content is stale: ${name}.`);
    } catch (error) {
      errors.push(`Generated content is missing: ${name} (${error.message}).`);
    }
  }
  return errors;
}

export async function runSeptemberValidation({
  release = false,
  gifts = SEPTEMBER_GIFTS,
  publicDir = defaultPublicDir,
  manifestPath = defaultManifestPath,
} = {}) {
  const errors = validateSeptemberContent(gifts, { release });
  const loadedManifest = await loadManifest(manifestPath);
  errors.push(...loadedManifest.errors);
  if (loadedManifest.manifest) {
    errors.push(
      ...await validateSeptemberMedia({
        gifts,
        publicDir,
        manifest: loadedManifest.manifest,
      }),
    );
  }
  if (!release && errors.length === 0) errors.push(...await validateGeneratedArtifacts());
  return [...new Set(errors)];
}

async function main() {
  const argumentsList = process.argv.slice(2);
  const unknownArguments = argumentsList.filter(
    (argument) => argument !== "--release",
  );
  if (unknownArguments.length > 0) {
    console.error(`Unknown argument: ${unknownArguments.join(" ")}`);
    process.exitCode = 1;
    return;
  }

  const release = argumentsList.includes("--release");
  const errors = await runSeptemberValidation({ release });
  if (errors.length > 0) {
    console.error(
      `September ${release ? "release" : "development"} validation failed with ${errors.length} error(s):`,
    );
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log(
    `September ${release ? "release" : "development"} validation passed: ${SEPTEMBER_GIFTS.length} gifts and ${SEPTEMBER_GIFTS.length * 3} product encodings checked.`,
  );
}

if (path.resolve(process.argv[1] ?? "") === scriptPath) {
  await main();
}
