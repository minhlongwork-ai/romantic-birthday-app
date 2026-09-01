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
    "./core/personalization.mjs",
    "./core/session.mjs",
    "./ui/scenes.js",
    "./ui/dom.js",
  ]) {
    const absoluteUrl = pathToFileURL(path.join(appRoot, "src", relativePath.slice(2))).href;
    source = source.replaceAll(`"${relativePath}"`, JSON.stringify(absoluteUrl));
  }
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}

function createRoot() {
  const root = {
    children: [],
    dataset: {},
    replaceChildren(...nextChildren) {
      for (const child of root.children) {
        child.isConnected = false;
        child.parentNode = null;
      }
      root.children = nextChildren.filter(Boolean);
      for (const child of root.children) {
        child.isConnected = true;
        child.parentNode = root;
      }
    },
    querySelectorAll(selector) {
      if (selector !== "[data-product-card]") return [];
      const cards = [];
      const visit = (node) => {
        if (node?.dataset?.productCard === "") cards.push(node);
        for (const child of node?.children ?? []) visit(child);
      };
      root.children.forEach(visit);
      return cards;
    },
  };
  return root;
}

function createSceneNode(name) {
  return { children: [], dataset: { scene: name }, isConnected: false, parentNode: null };
}

function createProductCard() {
  return {
    children: [],
    dataset: { productCard: "" },
    isConnected: false,
    parentNode: null,
    querySelector() {
      return null;
    },
  };
}

function mountScene(root, name, disposals) {
  const node = createSceneNode(name);
  root.replaceChildren(node);
  return {
    dispose() {
      disposals.push(name);
      if (node.parentNode === root) root.replaceChildren();
    },
  };
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
  const root = createRoot();
  const workshopDisposals = [];
  const revealDisposals = [];
  const mounts = {
    intro: (mountRoot) => mountScene(mountRoot, "intro", []),
    workshop: (mountRoot) => mountScene(mountRoot, "workshop", workshopDisposals),
    reveal: revealMount ?? ((mountRoot) => {
      const card = createProductCard();
      mountRoot.replaceChildren(card);
      return {
        card,
        dispose() {
          revealDisposals.push("reveal");
          if (card.parentNode === root) root.replaceChildren();
        },
      };
    }),
    ending: (mountRoot) => mountScene(mountRoot, "ending", []),
  };
  const history = {
    pushState(entry, unused, url) {
      pushes.push({ entry, unused, url });
    },
    replaceState(entry, unused, url) {
      replaces.push({ entry, unused, url });
    },
  };
  return { root, history, pushes, replaces, mounts, workshopDisposals, revealDisposals };
}

function createApp(runtime, harness, token) {
  return runtime.createSeptemberExperienceApp({
    ...harness,
    location: { pathname: "/september/", search: "" },
    tokenFactory: () => token,
    focusHeading() {},
  });
}

test("a stale reveal mount cannot commit, push history, or leave a product card", async () => {
  const runtime = await loadMainRuntime();
  let finishMount;
  const harness = createHarness({
    revealMount: (mountRoot) => new Promise((resolve) => {
      finishMount = () => {
        const card = createProductCard();
        mountRoot.replaceChildren(card);
        resolve({ card, dispose() {} });
      };
    }),
  });
  const app = createApp(runtime, harness, "session-a");
  readyWorkshop(app);
  harness.pushes.length = 0;

  const request = app.requestGiftReveal({ giftId: "cake", transaction: 4 });
  app.navigate("intro");
  finishMount();

  assert.equal(await request, false);
  assert.deepEqual(app.state.openOrder, []);
  assert.equal(harness.pushes.length, 1, "only the explicit intro navigation may push");
  assert.equal(harness.root.querySelectorAll("[data-product-card]").length, 0);
  assert.equal(app.activeScene.kind, "intro");
});

test("the reveal handoff owns cleanup once and restores a stable workshop after Back", async () => {
  const runtime = await loadMainRuntime();
  const harness = createHarness();
  const app = createApp(runtime, harness, "session-b");
  readyWorkshop(app);
  harness.pushes.length = 0;

  assert.equal(await app.requestGiftReveal({ giftId: "cake", transaction: 5 }), true);
  assert.deepEqual(app.state.openOrder, ["cake"]);
  assert.equal(harness.pushes.length, 1);
  assert.equal(harness.root.querySelectorAll("[data-product-card]").length, 1);
  assert.equal(harness.workshopDisposals.length, 1);
  assert.equal(harness.revealDisposals.length, 0);

  app.navigate("workshop");
  assert.equal(harness.revealDisposals.length, 1);
  assert.equal(harness.root.querySelectorAll("[data-product-card]").length, 0);
  app.restart();
  assert.equal(harness.revealDisposals.length, 1);
});

test("a failed reveal installs one replacement workshop cleanup owner", async () => {
  const runtime = await loadMainRuntime();
  const harness = createHarness({ revealMount: () => { throw new Error("mount failed"); } });
  const app = createApp(runtime, harness, "session-c");
  readyWorkshop(app);

  await app.requestGiftReveal({ giftId: "cake", transaction: 6 });
  assert.equal(app.activeScene.kind, "workshop");
  app.navigate("intro");
  assert.equal(harness.workshopDisposals.length, 2);
});

test("a late reveal completion after dispose cannot commit or attach a card", async () => {
  const runtime = await loadMainRuntime();
  let finishMount;
  const harness = createHarness({
    revealMount: (mountRoot) => new Promise((resolve) => {
      finishMount = () => {
        const card = createProductCard();
        mountRoot.replaceChildren(card);
        resolve({ card, dispose() {} });
      };
    }),
  });
  const app = createApp(runtime, harness, "session-d");
  readyWorkshop(app);
  harness.pushes.length = 0;

  const request = app.requestGiftReveal({ giftId: "cake", transaction: 7 });
  app.dispose();
  finishMount();

  assert.equal(await request, false);
  assert.deepEqual(app.state.openOrder, []);
  assert.equal(harness.pushes.length, 0);
  assert.equal(harness.root.querySelectorAll("[data-product-card]").length, 0);
});

test("dispose clears a synchronously mounted reveal before its awaited commit", async () => {
  const runtime = await loadMainRuntime();
  let revealDisposals = 0;
  const harness = createHarness({
    revealMount: (mountRoot) => {
      const card = createProductCard();
      mountRoot.replaceChildren(card);
      return {
        card,
        dispose() {
          revealDisposals += 1;
        },
      };
    },
  });
  const app = createApp(runtime, harness, "session-sync-dispose");
  readyWorkshop(app);
  harness.pushes.length = 0;

  const request = app.requestGiftReveal({ giftId: "cake", transaction: 70 });
  app.dispose();
  assert.equal(harness.root.querySelectorAll("[data-product-card]").length, 0);

  assert.equal(await request, false);
  assert.deepEqual(app.state.openOrder, []);
  assert.equal(harness.pushes.length, 0);
  assert.equal(revealDisposals, 1);
  assert.equal(harness.root.querySelectorAll("[data-product-card]").length, 0);
});

test("a late reveal completion after Back cannot overtake the restored workshop", async () => {
  const runtime = await loadMainRuntime();
  let finishMount;
  const harness = createHarness({
    revealMount: (mountRoot) => new Promise((resolve) => {
      finishMount = () => {
        const card = createProductCard();
        mountRoot.replaceChildren(card);
        resolve({ card, dispose() {} });
      };
    }),
  });
  const app = createApp(runtime, harness, "session-back");
  readyWorkshop(app);
  harness.pushes.length = 0;

  const request = app.requestGiftReveal({ giftId: "cake", transaction: 71 });
  app.handlePopState({ state: { v: 2, sessionToken: "session-back", scene: "workshop" } });
  finishMount();

  assert.equal(await request, false);
  assert.equal(app.activeScene.kind, "workshop");
  assert.deepEqual(app.state.openOrder, []);
  assert.equal(harness.pushes.length, 0);
  assert.equal(harness.root.querySelectorAll("[data-product-card]").length, 0);
});

test("valid Back to intro preserves in-memory progress for Forward to a committed reveal", async () => {
  const runtime = await loadMainRuntime();
  const harness = createHarness();
  const app = createApp(runtime, harness, "session-e");
  readyWorkshop(app);
  assert.equal(await app.requestGiftReveal({ giftId: "cake", transaction: 8 }), true);
  const revealEntry = app.historyEntry();

  app.handlePopState({ state: { v: 2, sessionToken: "session-e", scene: "intro" } });
  assert.equal(app.activeScene.kind, "intro");
  assert.deepEqual(app.state.openOrder, ["cake"]);
  assert.equal(harness.root.querySelectorAll("[data-product-card]").length, 0);

  app.handlePopState({ state: revealEntry });
  assert.equal(app.activeScene.kind, "reveal");
  assert.deepEqual(app.state.openOrder, ["cake"]);
  assert.equal(harness.root.querySelectorAll("[data-product-card]").length, 1);
});

test("a stale reveal completion cannot overtake a restart", async () => {
  const runtime = await loadMainRuntime();
  let finishMount;
  const harness = createHarness({
    revealMount: (mountRoot) => new Promise((resolve) => {
      finishMount = () => {
        const card = createProductCard();
        mountRoot.replaceChildren(card);
        resolve({ card, dispose() {} });
      };
    }),
  });
  const app = createApp(runtime, harness, "session-f");
  readyWorkshop(app);

  const request = app.requestGiftReveal({ giftId: "cake", transaction: 9 });
  app.restart();
  finishMount();

  assert.equal(await request, false);
  assert.equal(app.activeScene.kind, "intro");
  assert.deepEqual(app.state.openOrder, []);
  assert.equal(harness.root.querySelectorAll("[data-product-card]").length, 0);
});

test("a duplicate activation keeps one reveal mount, card, commit, and history entry", async () => {
  const runtime = await loadMainRuntime();
  let finishMount;
  let revealMounts = 0;
  const harness = createHarness({
    revealMount: (mountRoot) => new Promise((resolve) => {
      revealMounts += 1;
      finishMount = () => {
        const card = createProductCard();
        mountRoot.replaceChildren(card);
        resolve({ card, dispose() {} });
      };
    }),
  });
  const app = createApp(runtime, harness, "session-duplicate");
  readyWorkshop(app);
  harness.pushes.length = 0;

  const first = app.requestGiftReveal({ giftId: "cake", transaction: 10 });
  assert.equal(await app.requestGiftReveal({ giftId: "cake", transaction: 10 }), false);
  finishMount();

  assert.equal(await first, true);
  assert.equal(revealMounts, 1);
  assert.deepEqual(app.state.openOrder, ["cake"]);
  assert.equal(harness.pushes.length, 1);
  assert.equal(harness.root.querySelectorAll("[data-product-card]").length, 1);
});
