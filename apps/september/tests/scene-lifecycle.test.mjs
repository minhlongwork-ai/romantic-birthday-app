import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainPath = path.join(appRoot, "src", "main.js");

async function loadMainRuntime() {
  let source = await readFile(mainPath, "utf8");
  source = source.replace(/^import "@fontsource\/[^"]+";\n/gmu, "");
  for (const relativePath of [
    "./core/puzzle.mjs",
    "./core/personalization.mjs",
    "./core/nfc-progress.mjs",
    "./core/session.mjs",
    "./ui/scenes.js",
    "./ui/dom.js",
  ]) {
    const absoluteUrl = pathToFileURL(path.join(appRoot, "src", relativePath.slice(2))).href;
    source = source.replaceAll(`"${relativePath}"`, JSON.stringify(absoluteUrl));
  }
  if (!source.includes("export function createSeptemberExperienceApp")) {
    source = source.replace(/const root = document\.querySelector\("#september-app"\);[\s\S]*$/u, "");
  }
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}

function readyWorkshop(app) {
  app.navigate("workshop");
  app.continueWorkshop("BRIDGE_CONFIRMED");
  app.continueWorkshop("CHOOSE_LEFT");
  app.continueWorkshop("DELIVERY_READY");
}

function createHarness({ revealMount } = {}) {
  const pushes = [];
  const replaces = [];
  const root = {
    dataset: {},
    replaceChildren() {},
    querySelectorAll(selector) {
      return selector === "[data-product-card]" ? [] : [];
    },
  };
  const history = {
    pushState(entry) {
      pushes.push(entry);
    },
    replaceState(entry) {
      replaces.push(entry);
    },
  };
  const workshopDisposals = [];
  const revealDisposals = [];
  const mounts = {
    intro: () => ({ dispose() {} }),
    workshop: () => ({ dispose() { workshopDisposals.push("workshop"); } }),
    reveal: revealMount ?? (() => ({
      card: { isConnected: true, querySelector() { return null; } },
      dispose() { revealDisposals.push("reveal"); },
    })),
    ending: () => ({ dispose() {} }),
  };
  return { root, history, pushes, replaces, mounts, workshopDisposals, revealDisposals };
}

test("a stale reveal mount cannot commit, push history, or attach a product card", async () => {
  const { createSeptemberExperienceApp } = await loadMainRuntime();
  const harness = createHarness({
    revealMount: () => ({ card: { isConnected: false }, dispose() {} }),
  });
  const app = createSeptemberExperienceApp({
    ...harness,
    location: { pathname: "/september/", search: "" },
    tokenFactory: () => "session-a",
    focusHeading() {},
  });
  readyWorkshop(app);
  harness.pushes.length = 0;

  const result = await app.requestGiftReveal({ giftId: "cake", transaction: 4 });

  assert.equal(result, false);
  assert.deepEqual(app.state.openOrder, []);
  assert.equal(harness.pushes.length, 0);
  assert.equal(harness.root.querySelectorAll("[data-product-card]").length, 0);
});

test("the reveal handoff owns cleanup once and restores a stable workshop after Back", async () => {
  const { createSeptemberExperienceApp } = await loadMainRuntime();
  const harness = createHarness();
  const app = createSeptemberExperienceApp({
    ...harness,
    location: { pathname: "/september/", search: "" },
    tokenFactory: () => "session-b",
    focusHeading() {},
  });
  readyWorkshop(app);
  harness.pushes.length = 0;

  assert.equal(await app.requestGiftReveal({ giftId: "cake", transaction: 5 }), true);
  assert.deepEqual(app.state.openOrder, ["cake"]);
  assert.equal(harness.pushes.length, 1);
  assert.equal(harness.workshopDisposals.length, 1);
  assert.equal(harness.revealDisposals.length, 0);

  app.navigate("workshop");
  assert.equal(harness.revealDisposals.length, 1);
  app.restart();
  assert.equal(harness.revealDisposals.length, 1);
});

test("a failed reveal installs one replacement workshop cleanup owner", async () => {
  const { createSeptemberExperienceApp } = await loadMainRuntime();
  const harness = createHarness({ revealMount: () => { throw new Error("mount failed"); } });
  const app = createSeptemberExperienceApp({
    ...harness,
    location: { pathname: "/september/", search: "" },
    tokenFactory: () => "session-c",
    focusHeading() {},
  });
  readyWorkshop(app);

  await app.requestGiftReveal({ giftId: "cake", transaction: 6 });
  assert.equal(app.activeScene.kind, "workshop");
  app.navigate("intro");
  assert.equal(harness.workshopDisposals.length, 2);
});

test("a stale reveal completion cannot overtake a restart", async () => {
  const { createSeptemberExperienceApp } = await loadMainRuntime();
  let finishMount;
  const harness = createHarness({
    revealMount: () => new Promise((resolve) => {
      finishMount = resolve;
    }),
  });
  const app = createSeptemberExperienceApp({
    ...harness,
    location: { pathname: "/september/", search: "" },
    tokenFactory: () => "session-d",
    focusHeading() {},
  });
  readyWorkshop(app);

  const request = app.requestGiftReveal({ giftId: "cake", transaction: 7 });
  app.restart();
  finishMount({ card: { isConnected: true }, dispose() {} });

  assert.equal(await request, false);
  assert.equal(app.activeScene.kind, "intro");
  assert.deepEqual(app.state.openOrder, []);
});
