import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { APP_CONFIG, SCENES, WISHES } from "../src/herbarium/config.js";
import { parseLyricText } from "../src/herbarium/lyric-timeline.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const botanicalAssets = [
  "poppy",
  "dahlia",
  "gladiolus",
  "babys-breath",
  "lily",
  "olive",
];
const audioAssets = ["co-em-madihu-low-g.mp3"];
const lyricAssets = ["co-em-lyrics.txt"];
const fontAssets = [
  "dancing-script-vi.woff2",
  "dancing-script-latin.woff2",
  "OFL-DancingScript.txt",
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
  "src/herbarium/photo-reveal.js",
  "src/herbarium/arrangement-engine.js",
  "src/herbarium/postcard-renderer.js",
  "src/herbarium/sender-signature.js",
  "src/herbarium/lyric-timeline.js",
  "src/herbarium/soundtrack-controller.js",
  ...botanicalAssets.flatMap((name) => [
    `public/images/herbarium/${name}.webp`,
    `public/images/herbarium/${name}.png`,
  ]),
  ...fontAssets.map((name) => `public/fonts/${name}`),
  ...audioAssets.map((name) => `public/audio/${name}`),
  ...lyricAssets.map((name) => `public/audio/${name}`),
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

for (const assetName of audioAssets) {
  const audioPath = `public/audio/${assetName}`;
  if (!(await fileExists(audioPath))) continue;
  const fileStats = await stat(path.join(projectRoot, audioPath));
  if (fileStats.size > 5 * 1024 * 1024) {
    fail(`${audioPath} exceeds the 5 MiB soundtrack limit.`);
  }
}

for (const assetName of lyricAssets) {
  const lyricPath = `public/audio/${assetName}`;
  if (!(await fileExists(lyricPath))) continue;
  const fileStats = await stat(path.join(projectRoot, lyricPath));
  if (fileStats.size > 64 * 1024) {
    fail(`${lyricPath} exceeds the 64 KiB lyric asset limit.`);
    continue;
  }
  const cues = parseLyricText(await readFile(path.join(projectRoot, lyricPath), "utf8"));
  if (
    cues.length !== 25 ||
    cues[0]?.start !== 8 ||
    cues.at(-1)?.start !== 193 ||
    !cues.every(
      (cue, index) => index === 0 || cue.start > cues[index - 1].start,
    )
  ) {
    fail(`${lyricPath} must contain 25 chronological cues from 0:08 to 3:13.`);
  }
}

if (APP_CONFIG.soundtrack.lyricsSrc !== "/audio/co-em-lyrics.txt") {
  fail("Soundtrack lyricsSrc must reference the self-hosted lyric asset.");
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
  const totalAudioBytes = (
    await Promise.all(
      audioAssets.map(async (name) => {
        const fileStats = await stat(path.join(projectRoot, `public/audio/${name}`));
        return fileStats.size;
      }),
    )
  ).reduce((sum, size) => sum + size, 0);

  console.log(
    `Production validation passed: ${SCENES.length} scenes, ${requiredFiles.length} required files, ${totalWebpBytes} botanical WebP bytes, ${totalAudioBytes} audio bytes.`,
  );
}
