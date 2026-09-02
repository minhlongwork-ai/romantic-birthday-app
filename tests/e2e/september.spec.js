import { expect, test } from "@playwright/test";

const FINAL_LETTER = "Anh không ở cạnh lúc em mở thiếp, nên gửi một xưởng nhỏ thay anh chuẩn bị mọi thứ. Bánh để em có một chút ngọt, hoa để ngày của em đẹp hơn. Còn anh chỉ muốn em biết: dù không ở đây, anh vẫn muốn có mặt trong ngày của em theo một cách nhỏ thôi.";

test("September opens as a direct letter with both wishes", async ({ page }) => {
  await page.goto("/september/?to=Minh&from=Long&age=29");

  await expect(page).toHaveTitle(/Gửi Minh \| Một chút ngọt, một chút hoa/u);
  await expect(page.locator('section[data-scene="letter"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gửi Minh," })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Một chút ngọt" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Một chút hoa" })).toBeVisible();
  await expect(page.getByText("Có một chút chua dịu, một chút ngọt vừa đủ.")).toBeVisible();
  await expect(page.getByText("Bó hoa này không cần một dịp để được gửi đi.")).toBeVisible();
  await expect(page.getByText(FINAL_LETTER)).toBeVisible();
  await expect(page.getByText("29", { exact: true })).toHaveCount(0);
  await expect(page.locator(".blind-box, .garden-canvas, [data-gift-id]")).toHaveCount(0);
});

test("personalization is normalized and text-only", async ({ page }) => {
  await page.goto("/september/?to=%20%20Mi%CC%81nh%20%20Anh%20%20&from=%3Cimg%20id%3Devil%20src%3Dx%3E");

  await expect(page.getByRole("heading", { name: "Gửi Mính Anh," })).toBeVisible();
  await expect(page.locator("#evil")).toHaveCount(0);
});

test("read again returns the reader to the start of the letter", async ({ page }) => {
  await page.goto("/september/");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole("button", { name: "Đọc lại từ đầu" }).click();

  await expect(page.getByRole("heading", { name: "Để hôm nay có thêm một điều để nhớ." })).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
