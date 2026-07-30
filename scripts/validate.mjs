import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SCENES, WISHES } from "../src/herbarium/config.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const botanicalAssets = [
  "poppy",
  "dahlia",
  "gladiolus",
  "babys-breath",
  "olive",
];
const fontAssets = [
  "cormorant-garamond-vi.woff2",
  "cormorant-garamond-latin.woff2",
  "cormorant-garamond-italic-vi.woff2",
  "cormorant-garamond-italic-latin.woff2",
];
const requiredFiles = [
  "index.html",
  "package.json",
  "scripts/dev-server.mjs",
  "src/base.css",
  "src/main.js",
  "src/herbarium/config.js",
  "src/herbarium/scenes.js",
  "src/herbarium/herbarium.css",
  "src/herbarium/photo-engine.js",
  "src/herbarium/arrangement-engine.js",
  "src/herbarium/postcard-renderer.js",
  ...botanicalAssets.flatMap((name) => [
    `public/images/herbarium/${name}.webp`,
    `public/images/herbarium/${name}.png`,
  ]),
  ...fontAssets.map((name) => `public/fonts/${name}`),
];
const productionTextFiles = requiredFiles.filter((relativePath) =>
  /\.(?:html|css|js|mjs|json)$/u.test(relativePath),
);
const failures = [];

async function fileExists(relativePath) {
  try {
    await access(path.join(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

function fail(message) {
  failures.push(message);
}

function findFirstDash(source) {
  const index = source.search(/[\u2013\u2014]/u);
  if (index < 0) return null;
  const before = source.slice(0, index);
  const lines = before.split("\n");
  return {
    character: source[index],
    line: lines.length,
    column: lines.at(-1).length + 1,
  };
}

function maskNonVisibleDashPatterns(relativePath, source) {
  if (!relativePath.endsWith(".js")) return source;
  return source.replace(
    /\/\[[^\]\r\n]*[\u2013\u2014][^\]\r\n]*\]\/[dgimsuvy]*/gu,
    (match) => " ".repeat(match.length),
  );
}

for (const relativePath of requiredFiles) {
  if (!(await fileExists(relativePath))) {
    fail(`Missing required file: ${relativePath}`);
    continue;
  }
  const fileStats = await stat(path.join(projectRoot, relativePath));
  if (!fileStats.isFile() || fileStats.size === 0) {
    fail(`Required file is empty or not a regular file: ${relativePath}`);
  }
}

for (const assetName of botanicalAssets) {
  const webpPath = `public/images/herbarium/${assetName}.webp`;
  const pngPath = `public/images/herbarium/${assetName}.png`;
  if (await fileExists(webpPath)) {
    const fileStats = await stat(path.join(projectRoot, webpPath));
    if (fileStats.size > 350 * 1024) {
      fail(`${webpPath} exceeds the 350 KiB interactive asset limit.`);
    }
  }
  if (await fileExists(pngPath)) {
    const fileStats = await stat(path.join(projectRoot, pngPath));
    if (fileStats.size > 1.2 * 1024 * 1024) {
      fail(`${pngPath} exceeds the 1.2 MiB fallback asset limit.`);
    }
  }
}

if (SCENES.length !== 7 || new Set(SCENES).size !== 7) {
  fail("Herbarium flow must declare exactly seven unique scenes.");
}

if (WISHES.length !== 3 || new Set(WISHES.map(({ id }) => id)).size !== 3) {
  fail("Herbarium flow must declare exactly three unique wishes.");
}

if (await fileExists("index.html")) {
  const indexSource = await readFile(path.join(projectRoot, "index.html"), "utf8");
  if (/rain-window|rain-garden|src\/variants/iu.test(indexSource)) {
    fail("index.html still imports the retired Rain Window experience.");
  }
  if (!indexSource.includes("src/herbarium/herbarium.css")) {
    fail("index.html does not import the Herbarium visual system.");
  }
}

for (const relativePath of productionTextFiles) {
  if (!(await fileExists(relativePath))) continue;
  const source = await readFile(path.join(projectRoot, relativePath), "utf8");
  const dash = findFirstDash(maskNonVisibleDashPatterns(relativePath, source));
  if (dash) {
    const name = dash.character === "\u2014" ? "em dash" : "en dash";
    fail(
      `${relativePath}:${dash.line}:${dash.column} contains a ${name}; rewrite visible copy.`,
    );
  }
  if (relativePath !== "scripts/dev-server.mjs" && /https?:\/\//iu.test(source)) {
    fail(`${relativePath} contains an external runtime URL.`);
  }
}

if (failures.length > 0) {
  console.error(`Production validation failed with ${failures.length} issue(s):`);
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  const totalWebpBytes = (
    await Promise.all(
      botanicalAssets.map(async (name) => {
        const fileStats = await stat(
          path.join(projectRoot, `public/images/herbarium/${name}.webp`),
        );
        return fileStats.size;
      }),
    )
  ).reduce((sum, size) => sum + size, 0);

  console.log(
    `Production validation passed: ${SCENES.length} scenes, ${requiredFiles.length} required files, ${totalWebpBytes} botanical WebP bytes.`,
  );
}
