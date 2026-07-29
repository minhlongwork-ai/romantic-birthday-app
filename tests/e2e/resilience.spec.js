import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ baseURL, page }) => {
  const appOrigin = new URL(baseURL).origin;
  await page.route(/^https?:\/\//, route => {
    const requestOrigin = new URL(route.request().url()).origin;
    return requestOrigin === appOrigin ? route.continue() : route.abort();
  });
});

test('refresh restores the current scene and memory without trapping the recipient', async ({
  page,
}) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('./');
  await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
  await page.getByRole('button', { name: /Đi thẳng đến những kỷ niệm/i }).click();
  await expect(page.locator('#gallery-progress')).toHaveText('Trang 1 / 21');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#gallery-progress')).toHaveText('Trang 3 / 21');

  await page.reload();

  await expect(page.getByRole('heading', { name: /Ký ức của chúng mình/i })).toBeVisible();
  await expect(page.locator('#gallery-progress')).toHaveText('Trang 3 / 21');
  await expect(page.getByRole('button', { name: /Quay lại/i })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('the critical paper scenes fit at 320px with 200 percent text and reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?age=1');
  await page.addStyleTag({
    content: ':root { font-size: 200% !important; }',
  });

  async function expectNoHorizontalOverflow() {
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(1);
  }

  await expect(page.locator('body')).toHaveClass(/reduced-motion/);
  await expectNoHorizontalOverflow();

  await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
  await expect(page.getByRole('heading', { name: /Một lá thư dành cho em/i })).toBeVisible();
  await expectNoHorizontalOverflow();

  await page.getByRole('button', { name: /Ước một điều nhé/i }).click();
  await expect(page.getByRole('heading', { name: /Nhắm mắt/i })).toBeVisible();
  await expectNoHorizontalOverflow();

  await page.getByRole('button', { name: /Chạm để thổi nến/i }).click();
  await expect(page.locator('#gift-product-visual')).toBeVisible();
  await expectNoHorizontalOverflow();

  await page.getByRole('button', { name: /Mở những kỷ niệm/i }).click();
  await expect(page.getByRole('heading', { name: /Ký ức của chúng mình/i })).toBeVisible();
  await expectNoHorizontalOverflow();

  const controlsMeetTouchTarget = await page
    .locator('button:visible')
    .evaluateAll(buttons =>
      buttons.every(button => {
        const { width, height } = button.getBoundingClientRect();
        return width >= 44 && height >= 44;
      }),
    );
  expect(controlsMeetTouchTarget).toBe(true);
});
