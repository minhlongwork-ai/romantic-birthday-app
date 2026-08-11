import { expect, test } from '@playwright/test';

async function openFinaleWithoutPhoto(page, baseURL) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(new URL('../august/?to=Em&from=Shyn', baseURL).href);
  await page.getByRole('button', { name: 'Mở thư', exact: true }).click();
  await page.getByRole('button', { name: /Xem điều dành cho em/i }).click();
  await page.getByRole('radio').first().click();
  await page.getByRole('button', { name: /Mang điều này theo/i }).click();
  await page.getByRole('button', { name: 'Để sau' }).click();
  await page.getByRole('button', { name: /Ép hoa/i }).click();
  await expect(page.getByRole('heading', { name: /Một ngày tháng tám/i })).toBeVisible();
}

test.describe('August postcard sharing fallbacks', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chrome',
      'One Chromium project covers Web Share feature branches.',
    );
  });

  test('shares a generated PNG when Web Share accepts files', async ({ baseURL, page }) => {
    await page.addInitScript(() => {
      globalThis.__sharedPostcard = null;
      Object.defineProperty(navigator, 'canShare', {
        configurable: true,
        value: ({ files }) => files?.length === 1,
      });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async payload => { globalThis.__sharedPostcard = payload; },
      });
    });
    await openFinaleWithoutPhoto(page, baseURL);
    await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
    await expect(page.locator('[data-final-status]')).toContainText(/Đã mở bảng chia sẻ/i);
    const shared = await page.evaluate(() => ({
      count: globalThis.__sharedPostcard?.files?.length,
      name: globalThis.__sharedPostcard?.files?.[0]?.name,
      type: globalThis.__sharedPostcard?.files?.[0]?.type,
    }));
    expect(shared).toEqual({ count: 1, name: 'thang-tam-o-lai.png', type: 'image/png' });
  });

  test('keeps download available when file sharing is rejected', async ({ baseURL, page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', {
        configurable: true,
        value: () => false,
      });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async () => {},
      });
    });
    await openFinaleWithoutPhoto(page, baseURL);
    await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
    await expect(page.locator('[data-final-status]')).toContainText(/chưa thể chia sẻ tệp/i);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Lưu bưu thiếp/i }).click();
    expect((await downloadPromise).suggestedFilename()).toBe('thang-tam-o-lai.png');
  });

  test('hides share when the Web Share API is unavailable', async ({ baseURL, page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: undefined,
      });
    });
    await openFinaleWithoutPhoto(page, baseURL);
    await expect(page.getByRole('button', { name: 'Chia sẻ', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: /Lưu bưu thiếp/i })).toBeEnabled();
  });
});
