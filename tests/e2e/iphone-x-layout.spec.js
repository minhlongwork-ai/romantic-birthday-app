import { devices, expect, test } from '@playwright/test';

const iphoneX = Object.fromEntries(
  Object.entries(devices['iPhone X']).filter(([key]) => key !== 'defaultBrowserType'),
);
const syntheticPortrait = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0k0AAAAASUVORK5CYII=',
  'base64',
);

test.describe('iPhone X layout regressions', () => {
  test.use({
    ...iphoneX,
    serviceWorkers: 'block',
  });

  test.beforeEach(async ({ baseURL, page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'ios-safari',
      'The iPhone X regressions run once in the WebKit-backed iOS project.',
    );

    const appOrigin = new URL(baseURL).origin;
    await page.route(/^https?:\/\//, route => {
      const request = route.request();
      const requestOrigin = new URL(request.url()).origin;
      if (requestOrigin !== appOrigin || request.resourceType() === 'media') {
        return route.abort();
      }
      return route.continue();
    });
  });

  test('the chooser has no horizontal overflow', async ({ baseURL, page }) => {
    await page.goto(new URL('../', baseURL).href);

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Hôm nay em muốn mở điều gì?',
    })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('birthday keeps primary actions and the active chapter in view', async ({
    baseURL,
    page,
  }) => {
    await page.addInitScript(() => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
        if (String(type).startsWith('webgl')) return null;
        return originalGetContext.call(this, type, ...args);
      };
    });
    await page.route('**/swarovski-dancing-swan-5514421.*', route => route.abort());

    await page.goto(new URL('./?to=Em&from=Shyn&age=1', baseURL).href);
    await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
    await page.getByRole('button', { name: /Ước một điều nhé/i }).click();

    const blowCandle = page.getByRole('button', { name: /Chạm để thổi nến/i });
    await expectElementFullyInViewport(blowCandle);
    await blowCandle.click();

    await expect(page.locator('#cake-stage')).toHaveAttribute(
      'data-gift-state',
      'revealed',
    );
    const openMemories = page.getByRole('button', { name: /Mở những kỷ niệm/i });
    await expectElementFullyInViewport(openMemories);
    await openMemories.click();

    await expect(page.locator('#gallery-progress')).toHaveText('Trang 1 / 21');
    const chapterTabs = page.locator('#chapter-tabs');
    const lastChapter = chapterTabs.locator('.chapter-tab').last();

    // Invoke the same DOM click without Playwright pre-scrolling the off-screen tab.
    // The gallery itself must bring its newly active chapter into view.
    await lastChapter.evaluate(tab => tab.click());
    await expect(lastChapter).toHaveClass(/is-active/);
    await expectActiveChapterInsideNav(chapterTabs);

    await page.keyboard.press('ArrowLeft');
    await expectActiveChapterInsideNav(chapterTabs);
    await expectNoHorizontalOverflow(page);
  });

  test('august uses document scrolling and a single tap completes the herbarium', async ({
    baseURL,
    page,
  }) => {
    await page.goto(augustURL(baseURL));
    await page.getByRole('button', { name: 'Mở thư', exact: true }).click();

    const letterHeading = page.getByRole('heading', {
      level: 1,
      name: /Có những điều nhỏ/i,
    });
    await expect(letterHeading).toBeVisible();
    await expectSingleDocumentScroller(page);

    await page.evaluate(() => {
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      window.scrollTo(0, Math.min(140, maxScroll));
    });
    await expect.poll(() => headerTitleOverlap(page)).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: /Xem điều dành cho em/i }).click();
    await expect(page.getByRole('heading', {
      level: 1,
      name: /Tháng tám này/i,
    })).toBeVisible();
    await expectSingleDocumentScroller(page);

    await page.getByRole('radio').first().click();
    await page.getByRole('button', { name: /Mang điều này theo/i }).click();
    await expect(page.getByRole('heading', {
      level: 1,
      name: /Bó hoa đã đến rồi chứ/i,
    })).toBeVisible();
    await expectSingleDocumentScroller(page);

    await page.getByRole('button', { name: 'Để sau' }).click();
    await expect(page.getByRole('heading', {
      level: 1,
      name: /Đặt những cành hoa/i,
    })).toBeVisible();
    await expectSingleDocumentScroller(page);

    await page.getByRole('button', { name: /Ép hoa/i }).click();
    await expect(page.getByRole('heading', {
      level: 1,
      name: /Một ngày tháng tám/i,
    })).toBeVisible({ timeout: 3_000 });
    await expectNoHorizontalOverflow(page);
  });

  test('august photo editor controls keep 44px touch targets', async ({
    baseURL,
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(augustURL(baseURL));
    await page.getByRole('button', { name: 'Mở thư', exact: true }).click();
    await page.getByRole('button', { name: /Xem điều dành cho em/i }).click();
    await page.getByRole('radio').first().click();
    await page.getByRole('button', { name: /Mang điều này theo/i }).click();

    await page.locator('[data-library-input]').setInputFiles({
      name: 'local-photo-fixture.png',
      mimeType: 'image/png',
      buffer: syntheticPortrait,
    });
    await expect(page.locator('section[data-scene="photo-editor"]')).toBeVisible({
      timeout: 5_000,
    });

    const targets = page.locator('.choice-chip, [data-photo-zoom]');
    await expect(targets).toHaveCount(7);
    const undersized = await targets.evaluateAll(elements =>
      elements
        .map(element => {
          const bounds = element.getBoundingClientRect();
          return {
            label:
              element.getAttribute('aria-label') ||
              element.textContent?.trim() ||
              element.id,
            width: bounds.width,
            height: bounds.height,
            isRange: element.matches('input[type="range"]'),
          };
        })
        .filter(target =>
          target.isRange
            ? target.height < 44
            : target.width < 44 || target.height < 44,
        ),
    );

    expect(undersized).toEqual([]);
    await expectSingleDocumentScroller(page);
    await expectNoHorizontalOverflow(page);
  });
});

function augustURL(baseURL) {
  return new URL('../august/?to=Em&from=Shyn', baseURL).href;
}

async function expectNoHorizontalOverflow(page) {
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

async function expectElementFullyInViewport(locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(() =>
      locator.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const viewport = window.visualViewport;
        const left = viewport?.offsetLeft ?? 0;
        const top = viewport?.offsetTop ?? 0;
        const right = left + (viewport?.width ?? window.innerWidth);
        const bottom = top + (viewport?.height ?? window.innerHeight);
        return (
          bounds.left >= left - 1 &&
          bounds.top >= top - 1 &&
          bounds.right <= right + 1 &&
          bounds.bottom <= bottom + 1
        );
      }),
    )
    .toBe(true);
}

async function expectActiveChapterInsideNav(chapterTabs) {
  await expect
    .poll(() =>
      chapterTabs.evaluate(nav => {
        const active = nav.querySelector('.chapter-tab.is-active');
        if (!active) return false;
        const navBounds = nav.getBoundingClientRect();
        const activeBounds = active.getBoundingClientRect();
        return (
          activeBounds.left >= navBounds.left - 1 &&
          activeBounds.right <= navBounds.right + 1
        );
      }),
    )
    .toBe(true);
}

async function expectSingleDocumentScroller(page) {
  const nestedScroller = await page.locator('.herbarium-scene').evaluate(scene => {
    const style = getComputedStyle(scene);
    const verticallyScrollable =
      ['auto', 'scroll'].includes(style.overflowY) &&
      scene.scrollHeight > scene.clientHeight + 1;
    return {
      verticallyScrollable,
      overflowY: style.overflowY,
      clientHeight: scene.clientHeight,
      scrollHeight: scene.scrollHeight,
    };
  });

  expect(nestedScroller.verticallyScrollable, nestedScroller).toBe(false);
}

async function headerTitleOverlap(page) {
  return page.evaluate(() => {
    const header = document.querySelector('.scene-chrome');
    const title = document.querySelector('.scene-copy h1');
    if (!header || !title) return Number.POSITIVE_INFINITY;
    const headerBounds = header.getBoundingClientRect();
    const titleBounds = title.getBoundingClientRect();
    const horizontalOverlap =
      Math.min(headerBounds.right, titleBounds.right) -
      Math.max(headerBounds.left, titleBounds.left);
    if (horizontalOverlap <= 0) return 0;
    return Math.max(
      0,
      Math.min(headerBounds.bottom, titleBounds.bottom) -
        Math.max(headerBounds.top, titleBounds.top),
    );
  });
}
