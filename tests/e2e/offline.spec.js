import { expect, test } from "@playwright/test";

test("a loaded September workshop remains usable offline through its same-document touch flow", async ({ context, page }) => {
  await page.goto("/september/");
  await page.getByRole("button", { name: "Khởi động xưởng" }).click();
  await page.getByRole("button", { name: "Dùng chạm" }).click();
  await expect(page.getByRole("button", { name: "Nối đường ray" })).toBeVisible();
  await context.setOffline(true);
  try {
    await page.getByRole("button", { name: "Nối đường ray" }).press("Enter");
    await page.getByRole("button", { name: "Chọn lối trái" }).click();
    await expect(page.getByRole("button", { name: "Mở phong bì" })).toBeEnabled({ timeout: 5_000 });
    await page.getByRole("button", { name: "Mở phong bì" }).click();
    await expect(page.locator("[data-product-card] h2", { hasText: "Bánh tiramisu chanh" })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
