import { expect, test } from "@playwright/test";

const GIFTS = [
  { id: "cake", group: "Một chút ngọt", product: "Bánh tiramisu chanh — bản xem thử" },
  { id: "bouquet", group: "Một chút hoa", product: "Bó hồng kem và hồng phấn — bản xem thử" },
];

async function enterBox(page, query = "") {
  await page.goto(`/september/${query}`);
  await expect(page.getByRole("heading", { name: "Một chút ngọt, một chút hoa — anh chọn riêng cho em." })).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(page.locator('section[data-scene="box"]')).toBeVisible();
}

async function openGift(page, gift) {
  await page.getByRole("button", { name: `Mở ngăn ${gift.group}` }).click();
  await page.getByRole("button", { name: "Mở không dùng NFC" }).click();
  await expect(page.getByRole("heading", { name: gift.product })).toBeVisible({
    timeout: 5_000,
  });
  await page.getByRole("button", { name: "Trở về hộp quà" }).click();
}

async function openAllGifts(page) {
  for (const gift of GIFTS) await openGift(page, gift);
  await expect(page.getByRole("button", { name: "Thắt nơ cho món quà" })).toBeVisible();
}

async function enterPuzzle(page) {
  await enterBox(page);
  await openAllGifts(page);
  await page.getByRole("button", { name: "Thắt nơ cho món quà" }).click();
  await expect(page.locator('section[data-scene="game"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thắt nơ cho món quà" })).toBeFocused();
}

async function solvePuzzleWithButtons(page) {
  for (const ring of ["dải nơ ngoài", "dải nơ trong"]) {
    for (let step = 0; step < 3; step += 1) {
      await page.getByRole("button", { name: `Xoay ${ring} sang trái` }).click();
    }
  }
}

async function holdRingPointer(page, ringId = "outer") {
  await page.evaluate((id) => {
    window.__septemberHeldPointerId = null;
    document.querySelector(`[data-ring="${id}"]`)?.addEventListener("pointerdown", (event) => {
      window.__septemberHeldPointerId = event.pointerId;
    }, { once: true });
  }, ringId);
  const box = await page.locator(".ribbon-puzzle").boundingBox();
  expect(box).not.toBeNull();
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const radiusScale = { outer: 116 / 280, inner: 76 / 280 }[ringId];
  const radius = Math.min(box.width, box.height) * radiusScale;
  await page.mouse.move(centerX, centerY - radius);
  await page.mouse.down();
  await page.mouse.move(centerX + radius, centerY, { steps: 2 });
  const pointerId = await page.evaluate(() => window.__septemberHeldPointerId);
  expect(pointerId).not.toBeNull();
  return pointerId;
}

function desktopChromeOnly(testInfo) {
  test.skip(testInfo.project.name !== "desktop-chrome", "Deep September flows run once on desktop Chrome.");
}

test("an NFC sweet fragment opens cake and is cleaned immediately", async ({ page }) => {
  await page.goto("/september/#gift=sweet");
  await expect(page).toHaveURL(/\/september\/$/u);
  await expect(page.locator('section[data-scene="reveal"][data-gift-id="cake"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bánh tiramisu chanh — bản xem thử" })).toBeVisible();
});

test("manual fallback opens the same bouquet reveal", async ({ page }) => {
  await enterBox(page);
  await page.getByRole("button", { name: "Mở ngăn Một chút hoa" }).click();
  await expect(page.getByRole("dialog", { name: "Chạm iPhone vào thẻ quà" })).toBeVisible();
  await page.getByRole("button", { name: "Mở không dùng NFC" }).click();
  await expect(page.locator('section[data-gift-id="bouquet"]')).toBeVisible();
});

test("an NFC bloom fragment opens bouquet and is cleaned immediately", async ({ page }) => {
  await page.goto("/september/#gift=bloom");
  await expect(page).toHaveURL(/\/september\/$/u);
  await expect(page.locator('section[data-scene="reveal"][data-gift-id="bouquet"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bó hồng kem và hồng phấn — bản xem thử" })).toBeVisible();
});

test("malformed NFC fragments are cleaned and return to intro", async ({ page }) => {
  for (const fragment of ["#gift=moon", "#gift=sweet&to=Minh", "#gift=sweet&gift=bloom"]) {
    await page.goto(`/september/${fragment}`);
    await expect(page).toHaveURL(/\/september\/$/u);
    await expect(page.locator('section[data-scene="intro"]')).toBeVisible();
  }
});

test("the first direct NFC tag is remembered when the other tag opens", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/september/#gift=sweet");
  await expect(page.getByRole("heading", { name: GIFTS[0].product })).toBeVisible();

  await page.goto("/september/#gift=bloom");
  await expect(page.getByRole("heading", { name: GIFTS[1].product })).toBeVisible();
  await page.getByRole("button", { name: "Trở về hộp quà" }).click();
  await expect(page.getByRole("button", { name: /Xem lại Bánh tiramisu chanh/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Xem lại Bó hồng kem và hồng phấn/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thắt nơ cho món quà" })).toBeVisible();
});

test("a repeated NFC tag keeps one anonymous progress entry", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/september/#gift=sweet");
  await expect(page.getByRole("heading", { name: GIFTS[0].product })).toBeVisible();
  await page.goto("/september/#gift=sweet");
  await expect(page.getByRole("heading", { name: GIFTS[0].product })).toBeVisible();

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("september:nfc-progress:v1")),
  );
  expect(stored.foundGiftIds).toEqual(["cake"]);
  expect(Object.keys(stored).sort()).toEqual(["expiresAt", "foundGiftIds", "v"]);
});

test("an NFC reveal remains usable when storage is denied", async ({ page }) => {
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"]) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value() {
          throw new DOMException("Denied", "SecurityError");
        },
      });
    }
  });
  await page.goto("/september/#gift=bloom");
  await expect(page).toHaveURL(/\/september\/$/u);
  await expect(page.getByRole("heading", { name: GIFTS[1].product })).toBeVisible();
});

test("manual reveal remains usable when the localStorage getter is denied", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Denied", "SecurityError");
      },
    });
  });
  await enterBox(page);
  await page.getByRole("button", { name: "Mở ngăn Một chút ngọt" }).click();
  await page.getByRole("button", { name: "Mở không dùng NFC" }).click();
  await expect(page.getByRole("heading", { name: GIFTS[0].product })).toBeVisible();
});

test("expired NFC progress is removed before the intro opens", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("september:nfc-progress:v1", JSON.stringify({
      v: 1,
      foundGiftIds: ["cake"],
      expiresAt: Date.now() - 1,
    }));
  });
  await enterBox(page);
  await expect(page.getByRole("button", { name: "Mở ngăn Một chút ngọt" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("september:nfc-progress:v1"))).toBeNull();
});

test("September route presents two guaranteed gifts on every browser", async ({ page }) => {
  await page.goto("/september/?to=Minh&from=Long&age=29");
  await expect(page).toHaveTitle(/Gửi Minh \| Một chút ngọt, một chút hoa/);
  await expect(page.getByText("Cả hai đều là của em. Em chỉ cần chọn món mình muốn mở trước.")).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(page.locator(".compartment")).toHaveCount(2);
  await expect(page.getByText("29")).toHaveCount(0);
});

test("personalization is normalized and injected only as text", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  const query = "?to=%20%20Mi%CC%81nh%20%20Anh%20%20&from=%3Cimg%20id%3Devil%20src%3Dx%3E&age=99";
  await page.goto(`/september/${query}`);
  await expect(page.getByText("Dành cho Mính Anh")).toBeVisible();
  await expect(page.locator("#evil")).toHaveCount(0);
  await expect(page.getByText("99")).toHaveCount(0);
});

test("a personalized base URL keeps names while direct NFC uses generic names", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("september:nfc-progress:v1", JSON.stringify({
      v: 1,
      foundGiftIds: ["cake", "bouquet"],
      expiresAt: Date.now() + 60_000,
    }));
  });
  await enterBox(page, "?to=Minh&from=Long");
  await page.getByRole("button", { name: "Thắt nơ cho món quà" }).click();
  await page.getByRole("button", { name: "Bỏ qua và xem lời nhắn" }).click();
  await page.getByRole("button", { name: "Xem lời nhắn ngay" }).click();
  await expect(page.getByText("Minh, mong em thích hai món quà nhỏ này. Long chỉ muốn thấy em vui thôi.")).toBeVisible();

  const directPage = await page.context().newPage();
  await directPage.goto("/september/#gift=sweet");
  await expect(directPage.getByRole("heading", { name: GIFTS[0].product })).toBeVisible();
  await directPage.getByRole("button", { name: "Trở về hộp quà" }).click();
  await directPage.getByRole("button", { name: "Thắt nơ cho món quà" }).click();
  await directPage.getByRole("button", { name: "Bỏ qua và xem lời nhắn" }).click();
  await directPage.getByRole("button", { name: "Xem lời nhắn ngay" }).click();
  await expect(directPage.getByText("em, mong em thích hai món quà nhỏ này. anh chỉ muốn thấy em vui thôi.")).toBeVisible();
  await directPage.close();
});

test("a reveal commits once, can be revisited, and history keeps progress", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await enterBox(page);
  await page.getByRole("button", { name: "Mở ngăn Một chút hoa" }).click();
  await page.getByRole("button", { name: "Mở không dùng NFC" }).click();
  await expect(page.getByRole("heading", { name: GIFTS[1].product })).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Trở về hộp quà" }).click();
  await expect(page.getByRole("button", { name: /Xem lại Bó hồng kem và hồng phấn/ })).toBeFocused();

  await page.goBack();
  await expect(page.locator('section[data-scene="reveal"][data-gift-id="bouquet"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: GIFTS[1].product })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: /Xem lại Bó hồng kem và hồng phấn/ })).toBeVisible();
  await page.goForward();
  await expect(page.locator('section[data-scene="reveal"][data-gift-id="bouquet"]')).toBeVisible();
});

test("returning to the box restores only the opened compartment focus", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await enterBox(page);
  const compartment = page.getByRole("button", { name: "Mở ngăn Một chút ngọt" });
  await compartment.click();
  await page.getByRole("button", { name: "Để sau" }).click();
  await expect(compartment).toBeFocused();
  await compartment.click();
  await page.getByRole("button", { name: "Mở không dùng NFC" }).click();
  await expect(page.getByRole("heading", { name: GIFTS[0].product })).toBeVisible({ timeout: 5_000 });

  await page.evaluate(() => {
    window.__septemberFocusTrace = [];
    document.addEventListener("focusin", (event) => {
      window.__septemberFocusTrace.push(event.target.id || event.target.dataset.giftId || event.target.tagName);
    });
  });
  await page.getByRole("button", { name: "Trở về hộp quà" }).click();

  await expect(page.getByRole("button", { name: /Xem lại Bánh tiramisu chanh/ })).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.__septemberFocusTrace)).not.toContain("box-title");
});

for (const { motion, revealDelay } of [
  { motion: "no-preference", revealDelay: 1_900 },
  { motion: "reduce", revealDelay: 150 },
]) {
  test(`a product stays hidden and inaccessible until its ${motion} reveal completes`, async ({ page }, testInfo) => {
    desktopChromeOnly(testInfo);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: motion });
    await enterBox(page);
    await page.getByRole("button", { name: "Mở ngăn Một chút ngọt" }).click();
    await page.getByRole("button", { name: "Mở không dùng NFC" }).click();

    const product = page.locator(".reveal-product");
    const productHeading = page.getByRole("heading", { name: GIFTS[0].product });
    await expect(page.locator('section[data-scene="reveal"]')).toBeVisible();
    expect(await product.evaluate((node) => node.hidden)).toBe(true);
    await expect(product).toHaveAttribute("hidden", "", { timeout: 0 });
    expect(await productHeading.count()).toBe(0);

    await page.clock.runFor(revealDelay);
    await expect(product).toBeVisible();
    await expect(product).not.toHaveAttribute("hidden", "");
    await expect(productHeading).toBeVisible();
  });
}

test("skip confirmation preserves focus and still reveals all messages", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await enterBox(page);
  await openAllGifts(page);
  await page.getByRole("button", { name: "Thắt nơ cho món quà" }).click();

  const skip = page.getByRole("button", { name: "Bỏ qua và xem lời nhắn" });
  await skip.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Ở lại ghép" }).click();
  await expect(skip).toBeFocused();
  await skip.click();
  await page.getByRole("button", { name: "Xem lời nhắn ngay" }).click();

  await expect(page.locator(".gift-message")).toHaveCount(2);
  await expect(page.getByText("Không cần hoàn thành trò chơi để nhận đủ hai lời nhắn.")).toBeVisible();
  await expect(page.locator(".bow-flourish")).toHaveCount(0);
});

test("reset clears NFC progress only after replay confirmation", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await enterPuzzle(page);
  await page.getByRole("button", { name: "Bỏ qua và xem lời nhắn" }).click();
  await page.getByRole("button", { name: "Xem lời nhắn ngay" }).click();
  const replay = page.getByRole("button", { name: "Mở lại từ đầu" });

  await replay.click();
  await expect(page.getByRole("dialog", { name: "Mở lại từ đầu?" })).toBeVisible();
  await page.getByRole("button", { name: "Ở lại", exact: true }).click();
  await expect(replay).toBeFocused();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("september:nfc-progress:v1"))).not.toBeNull();

  await replay.click();
  await page.getByRole("button", { name: "Mở lại", exact: true }).click();
  await expect(page.locator('section[data-scene="intro"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("september:nfc-progress:v1"))).toBeNull();
});

test("the ribbon puzzle can be solved with visible buttons", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await enterPuzzle(page);

  for (const ring of ["dải nơ ngoài", "dải nơ trong"]) {
    for (let step = 0; step < 3; step += 1) {
      await page.getByRole("button", { name: `Xoay ${ring} sang trái` }).click();
    }
  }

  await expect(page.locator('section[data-scene="ending"]')).toBeVisible({ timeout: 3_000 });
  await expect(page.locator(".bow-flourish")).toHaveCount(1);
});

test("the ribbon puzzle can be solved with arrow keys", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await enterPuzzle(page);

  for (const label of ["Dải nơ ngoài", "Dải nơ trong"]) {
    const ring = page.getByRole("slider", { name: label });
    await ring.focus();
    await ring.press("ArrowLeft");
    await ring.press("ArrowLeft");
    await ring.press("ArrowLeft");
  }

  await expect(page.locator('section[data-scene="ending"]')).toBeVisible({ timeout: 3_000 });
});

test("the ribbon puzzle can be solved by dragging each ring", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await enterPuzzle(page);

  for (const ringId of ["outer", "inner"]) {
    const box = await page.locator(".ribbon-puzzle").boundingBox();
    expect(box).not.toBeNull();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const radiusScale = { outer: 116 / 280, inner: 76 / 280 }[ringId];
    const radius = Math.min(box.width, box.height) * radiusScale;
    await page.mouse.move(centerX, centerY - radius);
    await page.mouse.down();
    for (const angle of [-22.5, -45, -67.5, -90, -112.5, -135]) {
      const radians = angle * Math.PI / 180;
      await page.mouse.move(
        centerX + Math.sin(radians) * radius,
        centerY - Math.cos(radians) * radius,
        { steps: 2 },
      );
    }
    await page.mouse.up();
    await expect(page.locator(`[data-ring="${ringId}"]`)).toHaveAttribute(
      "aria-valuenow",
      String({ outer: 6, inner: 2 }[ringId]),
    );
  }

  await expect(page.locator('section[data-scene="ending"]')).toBeVisible({ timeout: 3_000 });
});

test("the puzzle hint appears after twenty active seconds without moving a ring", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await page.clock.install();
  await enterPuzzle(page);
  const hint = page.locator("[data-puzzle-hint]");
  await expect(hint).toBeHidden();
  await page.clock.runFor(20_250);
  await expect(hint).toHaveText("Gợi ý: xoay dải nơ ngoài sang trái 3 nấc.");
  await expect(page.getByRole("slider", { name: "Dải nơ ngoài" })).toHaveAttribute("aria-valuenow", "1");
});

test("reduced motion keeps ring orientation and removes interpolation", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterPuzzle(page);
  const outer = page.getByRole("slider", { name: "Dải nơ ngoài" });
  const before = await outer.evaluate((element) => getComputedStyle(element).transform);
  await page.getByRole("button", { name: "Xoay dải nơ ngoài sang phải" }).click();
  const after = await outer.evaluate((element) => ({
    transform: getComputedStyle(element).transform,
    transitionDuration: getComputedStyle(element).transitionDuration,
  }));
  expect(before).not.toBe("none");
  expect(after.transform).not.toBe("none");
  expect(after.transform).not.toBe(before);
  expect(after.transitionDuration).toBe("0s");
});

test("leaving a solved puzzle cancels its delayed ending navigation", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await enterPuzzle(page);
  for (const ring of ["dải nơ ngoài", "dải nơ trong"]) {
    for (let step = 0; step < 3; step += 1) {
      await page.getByRole("button", { name: `Xoay ${ring} sang trái` }).click();
    }
  }
  await page.goBack();
  await expect(page.locator('section[data-scene="box"]')).toBeVisible();
  await page.waitForTimeout(1_100);
  await expect(page.locator('section[data-scene="box"]')).toBeVisible();
  await expect(page.locator('section[data-scene="ending"]')).toHaveCount(0);
});

test("a queued solve callback cannot overwrite browser back while a ring is held", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.__septemberCompletionCallbacks = [];
    window.setTimeout = (callback, delay, ...args) => {
      const timer = nativeSetTimeout(callback, delay, ...args);
      if (delay === 900) {
        window.__septemberCompletionCallbacks.push(() => callback(...args));
      }
      return timer;
    };
  });
  await enterPuzzle(page);
  await solvePuzzleWithButtons(page);
  await expect(page.locator('section[data-scene="game"]')).toHaveClass(/is-solved/);
  await expect.poll(() => page.evaluate(() => window.__septemberCompletionCallbacks.length)).toBe(1);

  await holdRingPointer(page);
  await page.goBack();
  await expect(page.locator('section[data-scene="box"]')).toBeVisible();
  await page.mouse.up();
  await page.evaluate(() => window.__septemberCompletionCallbacks.at(-1)?.());

  await expect(page.locator('section[data-scene="box"]')).toBeVisible();
  await expect(page.locator('section[data-scene="ending"]')).toHaveCount(0);
});

test("cancel, lost capture, blur, and cleanup restore a held ring without completing the game", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await enterPuzzle(page);
  const outer = page.getByRole("slider", { name: "Dải nơ ngoài" });

  const changeHeldOuter = async () => {
    await outer.focus();
    await outer.press("ArrowRight");
    await expect(outer).toHaveAttribute("aria-valuenow", "2");
  };

  const cancelledPointerId = await holdRingPointer(page);
  await changeHeldOuter();
  await outer.dispatchEvent("pointercancel", { pointerId: cancelledPointerId, clientX: 0, clientY: 0 });
  await page.mouse.up();
  await expect(outer).toHaveAttribute("aria-valuenow", "1");
  await expect(page.locator('section[data-scene="game"]')).toBeVisible();

  const lostPointerId = await holdRingPointer(page);
  await changeHeldOuter();
  await outer.evaluate((ring, pointerId) => {
    if (ring.hasPointerCapture(pointerId)) ring.releasePointerCapture(pointerId);
  }, lostPointerId);
  await page.mouse.up();
  await expect(outer).toHaveAttribute("aria-valuenow", "1");
  await expect(page.locator('section[data-scene="game"]')).toBeVisible();

  await holdRingPointer(page);
  await changeHeldOuter();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up();
  await expect(outer).toHaveAttribute("aria-valuenow", "1");
  await expect(page.locator('section[data-scene="game"]')).toBeVisible();

  await holdRingPointer(page);
  await changeHeldOuter();
  await page.goBack();
  await page.mouse.up();
  await expect(page.locator('section[data-scene="box"]')).toBeVisible();
  await page.getByRole("button", { name: "Thắt nơ cho món quà" }).click();
  await expect(page.locator('section[data-scene="game"]')).toBeVisible();
  await expect(page.getByRole("slider", { name: "Dải nơ ngoài" })).toHaveAttribute("aria-valuenow", "1");
  await expect(page.locator('section[data-scene="ending"]')).toHaveCount(0);
});

test("mobile game and ending headings are focused inside the viewport", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterPuzzle(page);

  const gameHeading = page.getByRole("heading", { name: "Thắt nơ cho món quà" });
  await expect(gameHeading).toBeFocused();
  const gameGeometry = await gameHeading.evaluate((heading) => {
    const rect = heading.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
  });
  expect(gameGeometry.top).toBeGreaterThanOrEqual(0);
  expect(gameGeometry.bottom).toBeLessThanOrEqual(gameGeometry.viewportHeight);

  await page.getByRole("button", { name: "Bỏ qua và xem lời nhắn" }).click();
  await page.getByRole("button", { name: "Xem lời nhắn ngay" }).click();
  const endingHeading = page.getByRole("heading", { name: "Một chút ngọt. Một chút hoa." });
  await expect(endingHeading).toBeFocused();
  const endingGeometry = await endingHeading.evaluate((heading) => {
    const rect = heading.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
  });
  expect(endingGeometry.top).toBeGreaterThanOrEqual(0);
  expect(endingGeometry.bottom).toBeLessThanOrEqual(endingGeometry.viewportHeight);
});

test("mobile intro CTA stays in the first viewport without horizontal overflow", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/september/");
    const cta = page.getByRole("button", { name: "Bắt đầu" });
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.height).toBeGreaterThanOrEqual(44);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
  }
});

test("reload hydrates anonymous NFC progress at the intro", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await enterBox(page);
  await page.getByRole("button", { name: "Mở ngăn Một chút ngọt" }).click();
  await page.getByRole("button", { name: "Mở không dùng NFC" }).click();
  await expect(page.getByRole("heading", { name: GIFTS[0].product })).toBeVisible({ timeout: 5_000 });
  await page.reload();
  await expect(page.getByRole("heading", { name: /Một chút ngọt, một chút hoa/ })).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(page.getByRole("button", { name: /Xem lại Bánh tiramisu chanh/ })).toBeVisible();
});

test("a failed product image keeps the gift journey completable", async ({ page }, testInfo) => {
  desktopChromeOnly(testInfo);
  await page.route("**/september/images/cake.*", (route) => route.abort());
  await enterBox(page);
  await page.getByRole("button", { name: "Mở ngăn Một chút ngọt" }).click();
  await page.getByRole("button", { name: "Mở không dùng NFC" }).click();
  await expect(page.getByText("Ảnh món quà chưa tải được")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".fallback-silhouette-cake")).toBeVisible();
  await expect(page.getByRole("heading", { name: GIFTS[0].product })).toBeVisible();
  await page.getByRole("button", { name: "Trở về hộp quà" }).click();
  await expect(page.getByRole("button", { name: /Xem lại Bánh tiramisu chanh/ })).toBeVisible();
});

test("the loaded shell remains completable when the network drops before lazy images", async ({ page, context }, testInfo) => {
  desktopChromeOnly(testInfo);
  await enterBox(page);
  await context.setOffline(true);
  for (const gift of GIFTS) await openGift(page, gift);
  await page.getByRole("button", { name: "Thắt nơ cho món quà" }).click();
  await page.getByRole("button", { name: "Bỏ qua và xem lời nhắn" }).click();
  await page.getByRole("button", { name: "Xem lời nhắn ngay" }).click();
  await expect(page.locator(".gift-message")).toHaveCount(2);
  await context.setOffline(false);
});

test("an image decoded in the document remains usable after the network drops", async ({ page, context }, testInfo) => {
  desktopChromeOnly(testInfo);
  await enterBox(page);
  await page.getByRole("button", { name: "Mở ngăn Một chút ngọt" }).click();
  await page.getByRole("button", { name: "Mở không dùng NFC" }).click();
  const image = page.getByRole("img", { name: "Bánh kem chanh nhiều lớp với kem tươi và lát chanh trong bản xem thử" });
  await expect(image).toBeVisible({ timeout: 5_000 });
  await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Trở về hộp quà" }).click();
  await page.getByRole("button", { name: /Xem lại Bánh tiramisu chanh/ }).click();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
  await context.setOffline(false);
});
