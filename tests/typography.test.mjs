import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baseCss = await readFile(new URL("../src/base.css", import.meta.url), "utf8");
const herbariumCss = await readFile(
  new URL("../src/herbarium/herbarium.css", import.meta.url),
  "utf8",
);

test("scene titles use the self-hosted Vietnamese display font", () => {
  assert.match(
    baseCss,
    /--font-title:\s*\n?\s*"Cormorant Garamond"/u,
    "the title stack must start with the self-hosted Cormorant Garamond family",
  );
  assert.match(
    baseCss,
    /cormorant-garamond-vi\.woff2/u,
    "the Vietnamese subset must remain self-hosted",
  );
  assert.match(
    herbariumCss,
    /\.scene-copy h1\s*\{[^}]*font-family:\s*var\(--font-title\)/su,
    "scene headings must consume the dedicated title stack",
  );
});
