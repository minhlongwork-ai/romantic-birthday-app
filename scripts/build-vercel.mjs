#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}.`));
    });
  });
}

if (process.env.VERCEL_ENV === "production") {
  await run(process.execPath, ["apps/september/scripts/validate.mjs", "--release"]);
} else {
  console.log("September preview build: sender approval gate is deferred to production.");
}

await run(process.execPath, ["scripts/build-composite.mjs"]);
