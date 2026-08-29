#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveBuildEnvironment } from "./experience-builds.mjs";
import { loadExperienceRegistry } from "./experience-registry.mjs";
import { createReleaseValidationPlan } from "./experience-release.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args, env = process.env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}.`));
    });
  });
}

function parseCliOptions(argv) {
  const options = { production: false, registryUrl: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--production") {
      options.production = true;
      continue;
    }
    if (argument === "--registry-url") {
      const value = argv[index + 1];
      if (!value) throw new TypeError("--registry-url requires a URL.");
      options.registryUrl = new URL(value);
      index += 1;
      continue;
    }
    throw new TypeError(`Unknown build-vercel option: ${argument}`);
  }
  return options;
}

const options = parseCliOptions(process.argv.slice(2));
const environment = options.production
  ? "production"
  : resolveBuildEnvironment(process.env);
const records = await loadExperienceRegistry(
  options.registryUrl ? { registryUrl: options.registryUrl } : undefined,
);
const validationPlan = createReleaseValidationPlan(records, environment);

for (const validation of validationPlan) {
  await run(process.execPath, validation.argv);
}

if (environment !== "production") {
  console.log("September preview build: sender approval gate is deferred to production.");
}

await run(process.execPath, ["scripts/build-composite.mjs"], {
  ...process.env,
  EXPERIENCE_BUILD_ENV: environment,
});
