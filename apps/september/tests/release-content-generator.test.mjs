import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as releaseGenerator from "../scripts/generate-release-content.mjs";

const outputNames = [
  "runtime-media.mjs",
  "release-content.json",
  "media-manifest.json",
  "font-manifest.json",
];
const artifacts = Object.fromEntries(
  outputNames.map((name) => [name, `new:${name}\n`]),
);
const fileSystem = { mkdir, rename, rm, writeFile };

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "september-release-"));
  const destinationDir = path.join(root, "generated");
  await mkdir(destinationDir);
  await Promise.all(
    outputNames.map((name) =>
      writeFile(path.join(destinationDir, name), `old:${name}\n`, "utf8"),
    ),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  return {
    destinationDir,
    temporaryDir: `${destinationDir}.tmp-${process.pid}`,
    backupDir: `${destinationDir}.backup-${process.pid}`,
  };
}

async function assertDestinationIsUnchanged(destinationDir) {
  const contents = await Promise.all(
    outputNames.map((name) => readFile(path.join(destinationDir, name), "utf8")),
  );
  assert.deepEqual(
    contents,
    outputNames.map((name) => `old:${name}\n`),
  );
}

async function assertMissing(filePath) {
  await assert.rejects(access(filePath), { code: "ENOENT" });
}

test("a staging write failure preserves every destination and removes transaction directories", async (t) => {
  const { destinationDir, temporaryDir, backupDir } = await fixture(t);
  const injectedFileSystem = {
    ...fileSystem,
    async writeFile(filePath, ...args) {
      if (path.basename(filePath) === "media-manifest.json") {
        throw new Error("injected staging write failure");
      }
      return writeFile(filePath, ...args);
    },
  };

  await assert.rejects(
    releaseGenerator.publishArtifacts(artifacts, {
      destinationDir,
      fileSystem: injectedFileSystem,
    }),
    /injected staging write failure/u,
  );
  await assertDestinationIsUnchanged(destinationDir);
  await assertMissing(temporaryDir);
  await assertMissing(backupDir);
});

test("a directory publish failure rolls back every destination and removes transaction directories", async (t) => {
  const { destinationDir, temporaryDir, backupDir } = await fixture(t);
  const injectedFileSystem = {
    ...fileSystem,
    async rename(from, to) {
      if (from === temporaryDir && to === destinationDir) {
        throw new Error("injected directory publish failure");
      }
      return rename(from, to);
    },
  };

  await assert.rejects(
    releaseGenerator.publishArtifacts(artifacts, {
      destinationDir,
      fileSystem: injectedFileSystem,
    }),
    /injected directory publish failure/u,
  );
  await assertDestinationIsUnchanged(destinationDir);
  await assertMissing(temporaryDir);
  await assertMissing(backupDir);
});
