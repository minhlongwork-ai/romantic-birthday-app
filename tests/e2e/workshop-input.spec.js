import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";
import { build } from "vite";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const septemberRoot = path.join(projectRoot, "apps", "september");
const workshopInputUrl = pathToFileURL(
  path.join(septemberRoot, "src", "ui", "workshop-input.js"),
).href;

function contentType(filePath) {
  return filePath.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8";
}

async function serve(directory) {
  const server = createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const filePath = path.resolve(directory, `.${requestPath === "/" ? "/index.html" : requestPath}`);
      if (path.relative(directory, filePath).startsWith("..")) {
        response.writeHead(403);
        response.end();
        return;
      }
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
      response.end(await readFile(filePath));
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

async function buildHarness() {
  const root = await mkdtemp(path.join(os.tmpdir(), "september-workshop-input-"));
  const outDir = path.join(root, "dist");
  await writeFile(path.join(root, "entry.js"), `
    import { createWorkshopInput } from ${JSON.stringify(workshopInputUrl)};
    const stage = document.querySelector('#stage');
    const bridgeButton = document.querySelector('#bridge');
    const leftButton = document.querySelector('#left');
    const rightButton = document.querySelector('#right');
    window.__workshopClock = 0;
    window.__workshopCommands = [];
    window.__workshopBridgeClicks = [];
    bridgeButton.setPointerCapture = () => {};
    bridgeButton.releasePointerCapture = () => {};
    window.__workshopInput = createWorkshopInput({
      stage,
      bridgeButton,
      leftButton,
      rightButton,
      now: () => window.__workshopClock,
      onCommand: type => window.__workshopCommands.push(type),
    });
    window.__workshopInput.startTouch();
    bridgeButton.addEventListener('click', event => {
      window.__workshopBridgeClicks.push({ detail: event.detail, isTrusted: event.isTrusted });
    });
  `);
  await build({
    configFile: false,
    root,
    base: "/",
    publicDir: false,
    logLevel: "silent",
    build: {
      outDir,
      emptyOutDir: true,
      manifest: true,
      rollupOptions: { input: path.join(root, "entry.js") },
    },
  });
  const manifest = JSON.parse(await readFile(path.join(outDir, ".vite", "manifest.json"), "utf8"));
  const entry = Object.values(manifest).find(item => item.isEntry)?.file;
  if (!entry) throw new Error("Workshop input fixture did not emit an entry module.");
  await writeFile(
    path.join(outDir, "index.html"),
    `<main><div id=stage></div><button id=bridge>Nối đường ray</button><button id=left>Chọn lối trái</button><button id=right>Chọn lối phải</button><script type=module src=/${entry}></script></main>`,
  );
  return { root, outDir };
}

test("a real browser ignores a native click after an early primary bridge pointer release", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Run the pointer regression once in Chromium.");
  const fixture = await buildHarness();
  const server = await serve(fixture.outDir);
  try {
    await page.goto(server.url);
    await page.waitForFunction(() => Boolean(window.__workshopInput));

    const commands = await page.evaluate(() => {
      const bridge = document.querySelector("#bridge");
      const bounds = bridge.getBoundingClientRect();
      const pointer = (type, options) => bridge.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        isPrimary: true,
        pointerId: 7,
        pointerType: "touch",
        clientX: bounds.left + 8,
        clientY: bounds.top + 8,
        ...options,
      }));
      pointer("pointerdown");
      window.__workshopClock = 300;
      pointer("pointerup");
      bridge.click();
      return window.__workshopCommands;
    });

    expect(commands).toEqual([]);
  } finally {
    await server.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("a real early mouse release outside the bridge leaves one trusted keyboard confirmation available", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Run the pointer regression once in Chromium.");
  const fixture = await buildHarness();
  const server = await serve(fixture.outDir);
  try {
    await page.goto(server.url);
    await page.waitForFunction(() => Boolean(window.__workshopInput));

    const bridge = page.locator("#bridge");
    const bounds = await bridge.boundingBox();
    if (!bounds) throw new Error("Bridge control is not visible in the workshop input fixture.");

    await page.mouse.move(bounds.x + (bounds.width / 2), bounds.y + (bounds.height / 2));
    await page.mouse.down();
    await page.evaluate(() => {
      window.__workshopClock = 300;
    });
    await page.mouse.move(bounds.x + bounds.width + 80, bounds.y + (bounds.height / 2));
    await page.mouse.up();
    await bridge.focus();
    await page.keyboard.press("Enter");

    const result = await page.evaluate(() => ({
      commands: window.__workshopCommands,
      clicks: window.__workshopBridgeClicks,
    }));
    expect(result.commands).toEqual(["BRIDGE_CONFIRMED"]);
    expect(result.clicks.at(-1)).toEqual({ detail: 0, isTrusted: true });
  } finally {
    await server.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
});
