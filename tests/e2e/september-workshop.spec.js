import { expect, test } from "@playwright/test";

test("September removes personalization from the visible URL before the workshop renders", async ({ page }) => {
  await page.addInitScript(() => {
    const originalReplaceState = History.prototype.replaceState;
    window.__septemberReplaceCalls = [];
    History.prototype.replaceState = function replaceState(state, unused, url) {
      window.__septemberReplaceCalls.push({
        state: JSON.parse(JSON.stringify(state)),
        url: url === undefined ? "" : String(url),
      });
      return originalReplaceState.call(this, state, unused, url);
    };
  });

  await page.goto("/september/?to=Minh&from=Long&age=29");

  await expect(page).toHaveURL(/\/september\/$/u);
  await expect(page.locator('section[data-scene="intro"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Một xưởng nhỏ đang chờ em." })).toBeVisible();
  await expect(page.locator("[data-product-card]")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("29");
  const accessibilitySnapshot = await page.locator("body").ariaSnapshot();
  expect(accessibilitySnapshot).toContain("Một xưởng nhỏ đang chờ em.");
  expect(accessibilitySnapshot).not.toContain("29");

  const { historyState, replaces, visibleAddress } = await page.evaluate(() => ({
    historyState: window.history.state,
    replaces: window.__septemberReplaceCalls,
    visibleAddress: `${window.location.pathname}${window.location.search}${window.location.hash}`,
  }));
  expect(visibleAddress).toBe("/september/");
  expect(Object.keys(historyState).sort()).toEqual(["scene", "sessionToken", "v"]);
  expect(historyState).toMatchObject({ v: 2, scene: "intro" });
  expect(replaces).toHaveLength(1);
  expect(replaces[0]).toMatchObject({
    state: { v: 2, scene: "intro" },
    url: "/september/",
  });
  expect(Object.keys(replaces[0].state).sort()).toEqual(["scene", "sessionToken", "v"]);
});
