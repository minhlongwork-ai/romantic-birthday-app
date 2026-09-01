import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { contentTypeMatches } from "../../scripts/validate-build.mjs";

test("the median of five cold workshop intro LCP samples stays within the mobile 4G budget", async ({ baseURL, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome-https", "Chromium CDP provides deterministic throttling.");
  const samples = [];
  for (let sample = 0; sample < 5; sample += 1) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, connectionType: "cellular4g" });
    await page.addInitScript(() => {
      globalThis.__largestContentfulPaint = 0;
      new PerformanceObserver(list => { for (const entry of list.getEntries()) globalThis.__largestContentfulPaint = entry.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    await page.goto(baseURL, { waitUntil: "load" });
    await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    await expect.poll(() => page.evaluate(() => globalThis.__largestContentfulPaint)).toBeGreaterThan(0);
    samples.push(await page.evaluate(() => globalThis.__largestContentfulPaint));
    await context.close();
  }
  samples.sort((left, right) => left - right);
  expect(samples[2], `cold LCP samples: ${samples.join(", ")}`).toBeLessThanOrEqual(2_500);
  expect(samples[4], `cold LCP samples: ${samples.join(", ")}`).toBeLessThanOrEqual(3_000);
});

test("camera selected transfer stays within the encoded-byte cap", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome-https", "CDP network bytes are Chromium-only.");
  test.setTimeout(45_000);
  const manifest = JSON.parse(await readFile("dist/build-manifest.json", "utf8"));
  const expectedPaths = new Set(manifest.runtimeProfilesByRoute.september.camera);
  const expectedTypes = new Map(manifest.assets.map(asset => [asset.url, asset.contentType]));
  const pageCdp = await page.context().newCDPSession(page);
  const browserCdp = await browser.newBrowserCDPSession();
  await pageCdp.send("Network.enable");
  const encodedBytes = new Map();
  const responseInfo = new Map();
  const responseByPath = new Map();
  const workerSetupErrors = [];
  let commandId = 0;

  const recordResponse = (sessionId, event) => {
    const requestId = `${sessionId}:${event.requestId}`;
    responseInfo.set(requestId, {
      url: event.response.url, mimeType: event.response.mimeType,
      contentEncoding: event.response.headers["content-encoding"] || event.response.headers["Content-Encoding"] || "",
      contentType: event.response.headers["content-type"] || event.response.headers["Content-Type"] || "",
    });
    const response = responseInfo.get(requestId);
    const pathname = new URL(response.url).pathname;
    if (expectedPaths.has(pathname)) responseByPath.set(pathname, requestId);
  };
  const recordFinished = (sessionId, event) => encodedBytes.set(`${sessionId}:${event.requestId}`, event.encodedDataLength);
  pageCdp.on("Network.responseReceived", event => recordResponse("page", event));
  pageCdp.on("Network.loadingFinished", event => recordFinished("page", event));

  const sendToWorker = (sessionId, method, params = {}) => browserCdp.send("Target.sendMessageToTarget", {
    sessionId,
    message: JSON.stringify({ id: ++commandId, method, params }),
  });
  const configuredWorkers = new Set();
  const attachWorker = async targetInfo => {
    if (!/worker/u.test(targetInfo.type) || configuredWorkers.has(targetInfo.targetId)) return;
    configuredWorkers.add(targetInfo.targetId);
    void (async () => {
      try {
        const { sessionId } = await browserCdp.send("Target.attachToTarget", {
          targetId: targetInfo.targetId,
          flatten: false,
        });
        await sendToWorker(sessionId, "Network.enable");
      } catch (error) {
        workerSetupErrors.push(error instanceof Error ? error.message : String(error));
      }
    })();
  };
  browserCdp.on("Target.targetCreated", ({ targetInfo }) => { void attachWorker(targetInfo); });
  browserCdp.on("Target.receivedMessageFromTarget", event => {
    let message;
    try {
      message = JSON.parse(event.message);
    } catch {
      return;
    }
    if (message.method === "Network.responseReceived") recordResponse(event.sessionId, message.params);
    if (message.method === "Network.loadingFinished") recordFinished(event.sessionId, message.params);
  });
  await browserCdp.send("Target.setDiscoverTargets", { discover: true });
  const { targetInfos } = await browserCdp.send("Target.getTargets");
  await Promise.all(targetInfos.map(attachWorker));

  try {
    await page.goto("/september/");
    await page.getByRole("button", { name: "Khởi động xưởng" }).click();
    await page.getByRole("button", { name: "Dùng bàn tay" }).click();
    await expect(page.getByRole("button", { name: "Nối đường ray" })).toBeVisible();
    await expect.poll(() => {
      if (workerSetupErrors.length > 0) throw new Error(workerSetupErrors.join("\\n"));
      return responseByPath.size;
    }, { timeout: 30_000 }).toBe(expectedPaths.size);
    await expect.poll(() => [...responseByPath.values()].every(requestId => encodedBytes.has(requestId))).toBe(true);

    const cameraResponses = [...responseByPath.entries()].map(([pathname, requestId]) => [requestId, responseInfo.get(requestId), pathname]);
    expect(new Set(cameraResponses.map(([, , pathname]) => pathname))).toEqual(expectedPaths);
    expect(cameraResponses.every(([, response]) => new URL(response.url).origin === new URL(page.url()).origin)).toBe(true);
    expect(cameraResponses.every(([, response, pathname]) => contentTypeMatches(expectedTypes.get(pathname) || response.contentType, response.contentType))).toBe(true);
    expect(cameraResponses.some(([, response]) => /javascript/u.test(response.mimeType) && response.contentEncoding !== "")).toBe(true);
    expect(cameraResponses.reduce((total, [requestId]) => total + encodedBytes.get(requestId), 0)).toBeLessThanOrEqual(15 * 1024 * 1024);
  } finally {
    await browserCdp.detach();
  }
});
