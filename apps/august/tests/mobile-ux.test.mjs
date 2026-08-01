import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baseCss = await readFile(new URL("../src/base.css", import.meta.url), "utf8");
const herbariumCss = await readFile(
  new URL("../src/herbarium/herbarium.css", import.meta.url),
  "utf8",
);
const scenesSource = await readFile(
  new URL("../src/herbarium/scenes.js", import.meta.url),
  "utf8",
);

test("mobile scenes leave vertical scrolling to the document", () => {
  const mobileRules = herbariumCss.slice(
    herbariumCss.indexOf("@media (max-width: 780px)"),
    herbariumCss.indexOf("@media (max-width: 430px)"),
  );

  assert.match(mobileRules, /\.herbarium-scene\s*\{[^}]*overflow-y:\s*visible/su);
  assert.doesNotMatch(mobileRules, /overflow-y:\s*auto/u);
  assert.match(mobileRules, /\.scene-chrome\s*\{[^}]*position:\s*relative/su);
});

test("photo controls and sender option keep 44px touch targets", () => {
  assert.match(
    herbariumCss,
    /\.control-group input\[type="range"\]\s*\{[^}]*min-height:\s*2\.75rem/su,
  );
  assert.match(herbariumCss, /\.choice-chip\s*\{[^}]*min-height:\s*2\.75rem/su);
  assert.match(herbariumCss, /\.sender-toggle\s*\{[^}]*min-height:\s*3rem/su);
});

test("tap, click, Enter, and Space can complete the flower press", () => {
  const herbariumScene = scenesSource.slice(
    scenesSource.indexOf("function mountHerbarium"),
    scenesSource.indexOf("function finalFlowerMarkup"),
  );

  assert.match(herbariumScene, /addEventListener\("click", completePress/u);
  assert.match(herbariumScene, /event\.key !== "Enter" && event\.key !== " "/u);
  assert.doesNotMatch(herbariumScene, /event\.detail === 0/u);
  assert.match(
    herbariumScene,
    /Chạm một lần để ép ngay, hoặc nhấn giữ đến khi vòng tròn khép lại/u,
  );
});

test("mobile soundtrack sits in the reserved center of scene chrome", () => {
  const mobileRules = baseCss.slice(baseCss.indexOf("@media (max-width: 430px)"));

  assert.match(
    mobileRules,
    /\.soundtrack-root\s*\{[^}]*top:\s*max\(1\.1rem,[^}]*left:\s*50%/su,
  );
  assert.match(mobileRules, /transform:\s*translateX\(-50%\)/u);
  assert.match(mobileRules, /body:has\(\.photo-reveal\) \.soundtrack-root/u);
});
