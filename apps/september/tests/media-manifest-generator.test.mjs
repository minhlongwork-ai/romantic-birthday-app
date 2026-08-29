import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { publishMediaManifest } from "../scripts/generate-media-manifest.mjs";

test("a failed media-manifest publish preserves the existing file atomically", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "september-media-manifest-"));
  const destinationPath = path.join(root, "content", "media-manifest.json");
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await writeFile(destinationPath, "old manifest\n", "utf8");
  t.after(() => rm(root, { recursive: true, force: true }));

  const fileSystem = {
    mkdir,
    readFile,
    rename: async () => {
      throw new Error("injected atomic rename failure");
    },
    rm,
    writeFile,
  };

  await assert.rejects(
    publishMediaManifest("new manifest\n", { destinationPath, fileSystem }),
    /injected atomic rename failure/u,
  );
  assert.equal(await readFile(destinationPath, "utf8"), "old manifest\n");
  await assert.rejects(readFile(`${destinationPath}.tmp-${process.pid}`), {
    code: "ENOENT",
  });
});
