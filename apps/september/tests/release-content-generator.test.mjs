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
import { SEPTEMBER_GIFTS } from "../src/content/gifts.mjs";

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

function productionGifts() {
  return structuredClone(SEPTEMBER_GIFTS).map((gift) => ({
    ...gift,
    approved: true,
    fixture: false,
    variant: gift.id === "cake"
      ? "Bánh 18 cm · kem mascarpone chanh"
      : "Hồng kem và hồng phấn · giấy gói màu ngà",
    reason: gift.id === "cake"
      ? "Anh chọn vị chanh tươi để chiếc bánh ngọt vừa đủ."
      : "Anh chọn những màu hoa dịu dàng mà em thích.",
  }));
}

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

test("release artifacts derive fixture mode and omit preview copy for approved gifts", async () => {
  const generated = await releaseGenerator.buildArtifacts({
    release: true,
    gifts: productionGifts(),
  });
  const content = JSON.parse(generated["release-content.json"]);

  assert.equal(content.fixtureMode, false);
  assert.ok(content.gifts.every((gift) => gift.fixture === false));
  assert.doesNotMatch(
    generated["release-content.json"],
    /bản xem thử|Ảnh Pexels|chỉ để minh họa/iu,
  );
});
