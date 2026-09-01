import { expect, test } from "@playwright/test";

const GIFTS_BY_SIDE = Object.freeze({
  left: ["Bánh tiramisu chanh", "Bó hồng kem và hồng phấn"],
  right: ["Bó hồng kem và hồng phấn", "Bánh tiramisu chanh"],
});

async function enterWorkshop(page, mode = "touch") {
  await page.goto("/september/?to=Minh&from=Long&age=29");
  await expect(page).toHaveURL(/\/september\/$/u);
  await expect(page.getByRole("heading", { name: "Một xưởng nhỏ đang chờ em." })).toBeFocused();
  await page.getByRole("button", { name: "Khởi động xưởng" }).click();
  await expect(page.getByRole("heading", { name: "Cho xưởng mượn một bàn tay nhé?" })).toBeFocused();
  await page.getByRole("button", { name: mode === "camera" ? "Dùng bàn tay" : "Dùng chạm" }).click();
  await expect(page.getByRole("button", { name: "Nối đường ray" })).toBeVisible();
}

async function completeBridge(page, mode = "keyboard") {
  const bridge = page.getByRole("button", { name: "Nối đường ray" });
  if (mode === "touch") {
    const bounds = await bridge.boundingBox();
    if (!bounds) throw new Error("The bridge control is not visible.");
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(520);
    await page.mouse.up();
  } else {
    await bridge.press("Enter");
  }
  await expect(page.getByRole("button", { name: "Chọn lối trái" })).toBeVisible();
}

async function chooseBranch(page, side) {
  await page.getByRole("button", { name: side === "left" ? "Chọn lối trái" : "Chọn lối phải" }).click();
  await expect(page.locator("[data-workshop-phase='delivering-first']")).toBeVisible();
}

async function waitForEnvelope(page) {
  await expect(page.getByRole("button", { name: "Mở phong bì" })).toBeEnabled({ timeout: 5_000 });
}

async function openEnvelope(page) {
  await page.getByRole("button", { name: "Mở phong bì" }).click();
  await expect(page.locator("[data-product-card]")).toBeVisible({ timeout: 2_000 });
}

function productHeading(page, name) {
  return page.locator("[data-product-card] h2", { hasText: name });
}

async function expectFocusedInViewport(locator) {
  await expect(locator).toBeFocused();
  await expect.poll(() => locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    return box.top >= -1 && box.left >= -1 && box.bottom <= window.innerHeight + 1 && box.right <= window.innerWidth + 1;
  })).toBe(true);
}

function desktopChromeOnly(testInfo) {
  test.skip(testInfo.project.name !== "desktop-chrome", "The deterministic camera sequence runs once in Chromium.");
}

test("September removes personal data from the URL and keeps every product secret at intro", async ({ page }) => {
  await page.goto("/september/?to=Minh&from=Long&age=29");
  await expect(page).toHaveURL(/\/september\/$/u);
  await expect(page.getByRole("heading", { name: "Một xưởng nhỏ đang chờ em." })).toBeVisible();
  await expect(page.locator("[data-product-card], .demo-badge, .product-picture")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("29");
  const snapshot = await page.locator("body").ariaSnapshot();
  expect(snapshot).not.toContain("tiramisu");
  expect(snapshot).not.toContain("hồng kem");
});

for (const side of ["left", "right"]) {
  test(`${side} branch delivers both guaranteed gifts once without pre-reveal content`, async ({ page }) => {
    const [firstGift, secondGift] = GIFTS_BY_SIDE[side];
    await enterWorkshop(page);
    await completeBridge(page);
    await chooseBranch(page, side);
    await waitForEnvelope(page);
    await expect(page.getByRole("heading", { name: /tiramisu|hồng kem/u })).toHaveCount(0);
    await expect(page.locator("[data-product-card], .demo-badge, .product-picture")).toHaveCount(0);

    await openEnvelope(page);
    await expect(productHeading(page, firstGift)).toBeVisible();
    await expect(page.locator(".demo-badge")).toHaveText("Bản xem thử · ảnh minh họa");
    await page.getByRole("button", { name: "Cho xưởng chạy tiếp" }).click();
    await expect(page.locator("[data-workshop-phase='between-gifts']")).toBeVisible();
    await page.getByRole("button", { name: "Cho xưởng chạy tiếp" }).click();
    await waitForEnvelope(page);
    await openEnvelope(page);
    await expect(productHeading(page, secondGift)).toBeVisible();
    await expect(page.locator("[data-product-card]")).toHaveCount(1);
    await page.getByRole("button", { name: "Cho xưởng chạy tiếp" }).click();
    await expect(page.locator("[data-workshop-phase='complete']")).toBeVisible();
    await page.getByRole("button", { name: "Mở lá thư" }).click();
    await expect(page.getByText("Anh không ở cạnh lúc em mở thiếp")).toBeVisible();
  });
}

test("a premature, moved, cancelled, blurred, or secondary pointer cannot bypass the bridge while keyboard can", async ({ page }) => {
  await enterWorkshop(page);
  const bridge = page.getByRole("button", { name: "Nối đường ray" });
  const bounds = await bridge.boundingBox();
  if (!bounds) throw new Error("The bridge control is not visible.");
  await page.evaluate(({ x, y }) => {
    const control = document.querySelector(".workshop-bridge");
    const fire = (type, pointerId, pointX = x, pointY = y) => control.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, isPrimary: pointerId === 1, pointerId, pointerType: "touch", clientX: pointX, clientY: pointY,
    }));
    fire("pointerdown", 1); fire("pointerup", 1); fire("click", 1);
    fire("pointerdown", 2); fire("pointermove", 2, x + 20, y); fire("pointerup", 2, x + 20, y);
    fire("pointerdown", 3); fire("pointercancel", 3);
    fire("pointerdown", 4); window.dispatchEvent(new Event("blur"));
    fire("pointerdown", 5); fire("pointerdown", 6); fire("pointerup", 6);
  }, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
  await page.waitForTimeout(300);
  await expect(page.getByRole("button", { name: "Chọn lối trái" })).toHaveCount(0);
  await expect(page.locator("[data-workshop-phase]")).toHaveAttribute("data-workshop-phase", "invitation");
  await bridge.press("Enter");
  await expect(page.getByRole("button", { name: "Chọn lối trái" })).toBeVisible();
});

test("touch hold and keyboard select the identical first gift", async ({ browser }) => {
  for (const bridgeMode of ["keyboard", "touch"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await enterWorkshop(page);
      await completeBridge(page, bridgeMode);
      await chooseBranch(page, "left");
      await waitForEnvelope(page);
      await openEnvelope(page);
      await expect(productHeading(page, "Bánh tiramisu chanh")).toBeVisible();
    } finally {
      await context.close();
    }
  }
});

test("deterministic camera samples drive the real opt-in camera session to the same left branch", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await page.addInitScript(() => {
    window.__septemberCameraStarts = 0;
    window.__septemberCameraFixture = { bitmapCalls: 0, workerMessages: [] };
    window.Worker = class CameraSequenceWorker {
      constructor() { this.listeners = new Map(); this.startedAt = performance.now(); }
      addEventListener(type, listener) { this.listeners.set(type, listener); }
      removeEventListener(type) { this.listeners.delete(type); }
      emit(data) { this.listeners.get("message")?.({ data }); }
      postMessage(message) {
        window.__septemberCameraFixture.workerMessages.push(message.type);
        if (message.type === "init") queueMicrotask(() => this.emit({ type: "ready", generation: message.generation }));
        if (message.type === "frame") {
          const fork = performance.now() - this.startedAt > 850;
          queueMicrotask(() => this.emit({ type: "sample", generation: message.generation, sequence: message.sequence, timestampMs: performance.now(), tracking: true, openness: 0.9, palmX: fork ? 0.9 : 0.5, palmY: 0.5 }));
        }
      }
      terminate() {}
    };
    navigator.mediaDevices.getUserMedia = async () => {
      window.__septemberCameraStarts += 1;
      const canvas = document.createElement("canvas");
      canvas.width = 2; canvas.height = 2;
      const context = canvas.getContext("2d");
      setInterval(() => context.fillRect(0, 0, 2, 2), 16);
      return canvas.captureStream(30);
    };
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      writable: true,
      value: async () => {
        window.__septemberCameraFixture.bitmapCalls += 1;
        return { close() {} };
      },
    });
  });
  await enterWorkshop(page, "camera");
  await expect.poll(() => page.evaluate(() => window.__septemberCameraStarts)).toBe(1);
  await expect.poll(() => page.evaluate(() => JSON.stringify({
    phase: document.querySelector("[data-workshop-phase]")?.dataset.workshopPhase,
    notice: document.querySelector(".workshop-note:not([hidden])")?.textContent?.trim(),
    ...window.__septemberCameraFixture,
  })), { timeout: 4_000 }).toContain('"phase":"fork"');
  await expect(page.getByRole("button", { name: "Chọn lối trái" })).toBeVisible();
  await chooseBranch(page, "left");
  await waitForEnvelope(page);
  await openEnvelope(page);
  await expect(productHeading(page, "Bánh tiramisu chanh")).toBeVisible();
});

test("Back from sealed or opened delivery never auto-opens, reruns delivery, or reacquires camera", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await page.addInitScript(() => {
    window.__septemberCameraStarts = 0;
    navigator.mediaDevices.getUserMedia = async () => { window.__septemberCameraStarts += 1; throw new DOMException("Denied", "NotAllowedError"); };
  });
  await enterWorkshop(page, "camera");
  await completeBridge(page);
  await chooseBranch(page, "left");
  await waitForEnvelope(page);
  const startsAtEnvelope = await page.evaluate(() => window.__septemberCameraStarts);
  await page.goBack(); await page.goForward();
  await expect(page.getByRole("button", { name: "Mở phong bì" })).toBeVisible();
  await expect(page.locator("[data-product-card]")).toHaveCount(0);
  expect(await page.evaluate(() => window.__septemberCameraStarts)).toBe(startsAtEnvelope);
  await openEnvelope(page);
  await page.goBack();
  await expect(page.locator("[data-workshop-phase='between-gifts']")).toBeVisible();
  expect(await page.evaluate(() => window.__septemberCameraStarts)).toBe(startsAtEnvelope);
});

test("camera failure, WebGL fallback, image error, and same-document offline keep the touch/text route usable", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Denied", "NotAllowedError"); };
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function context(type, ...args) { return String(type).startsWith("webgl") ? null : original.call(this, type, ...args); };
  });
  await page.route("**/september/images/cake.*", route => route.abort());
  await enterWorkshop(page, "camera");
  await expect(page.getByText("Chạm để tiếp tục")).toBeVisible();
  await page.getByRole("button", { name: "Dùng chạm" }).click();
  await completeBridge(page);
  await chooseBranch(page, "left");
  await waitForEnvelope(page);
  await page.context().setOffline(true);
  try {
    await openEnvelope(page);
    await expect(page.getByRole("status")).toContainText("Ảnh món quà chưa tải được");
    await expect(productHeading(page, "Bánh tiramisu chanh")).toBeVisible();
  } finally {
    await page.context().setOffline(false);
  }
});

test("focus, touch targets, reduced motion, and late delivery cleanup hold at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/september/");
  await expectFocusedInViewport(page.getByRole("heading", { name: "Một xưởng nhỏ đang chờ em." }));
  await page.getByRole("button", { name: "Khởi động xưởng" }).click();
  await expectFocusedInViewport(page.getByRole("heading", { name: "Cho xưởng mượn một bàn tay nhé?" }));
  await page.getByRole("button", { name: "Dùng chạm" }).click();
  const undersized = await page.locator("button:visible").evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect(); return { width: box.width, height: box.height };
  }).filter(({ width, height }) => width < 44 || height < 44));
  expect(undersized).toEqual([]);
  const durations = await page.locator(".workshop-action, .workshop-envelope").evaluateAll(elements => elements.flatMap(element => getComputedStyle(element).transitionDuration.split(",").map(value => Number.parseFloat(value) * (value.includes("ms") ? 1 : 1000))));
  expect(Math.max(...durations)).toBeLessThanOrEqual(150);
  await completeBridge(page);
  await chooseBranch(page, "right");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Một xưởng nhỏ đang chờ em." })).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page.getByRole("button", { name: "Mở phong bì" })).toHaveCount(0);
});
