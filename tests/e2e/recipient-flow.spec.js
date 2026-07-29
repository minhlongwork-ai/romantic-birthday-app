import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ baseURL, page }) => {
  const appOrigin = new URL(baseURL).origin;
  await page.route(/^https?:\/\//, route => {
    const requestOrigin = new URL(route.request().url()).origin;
    return requestOrigin === appOrigin ? route.continue() : route.abort();
  });
});

test('recipient can begin the keepsake without exposing a photo upload', async ({ page }) => {
  const requestedPaths = [];
  page.on('request', request => {
    requestedPaths.push(new URL(request.url()).pathname);
  });
  await page.goto('./?to=Minh%20Anh&age=24&from=Long');

  await expect(page.getByRole('heading', { name: /Minh Anh/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mở cuốn album/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Add More|thêm ảnh/i })).toHaveCount(0);
  expect(
    requestedPaths.some(path =>
      /\/(?:audio\.mp3|images\/|vendor\/mediapipe\/)/.test(path),
    ),
  ).toBe(false);
  expect(
    requestedPaths.some(path =>
      /(?:gallery-scene|three\.module|postcard)/.test(path),
    ),
  ).toBe(false);
});

test('recipient completes the full gift with quiet audio, reduced motion, and no WebGL', async ({
  baseURL,
  page,
}) => {
  const pageErrors = [];
  const consoleErrors = [];
  const externalRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', request => {
    const url = new URL(request.url());
    if (
      ['http:', 'https:'].includes(url.protocol)
      && url.origin !== new URL(baseURL).origin
    ) {
      externalRequests.push(request.url());
    }
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
      if (String(type).startsWith('webgl')) return null;
      return original.call(this, type, ...args);
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException('Camera permission denied', 'NotAllowedError');
        },
      },
    });
  });

  await page.goto('./?to=An&age=2&from=Minh');
  await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
  await expect(page.getByRole('heading', { name: /Một lá thư dành cho em/i })).toBeVisible();

  await page.getByRole('button', { name: /Ước một điều nhé/i }).click();
  await expect(page.getByRole('heading', { name: /Nhắm mắt/i })).toBeVisible();
  await expect(page.locator('#cake-fallback')).toBeVisible();

  await page.getByRole('button', { name: /Dùng cử chỉ/i }).click();
  await expect(page.locator('#camera-status')).toContainText(/bị từ chối/i);

  const blowButton = page.getByRole('button', { name: /Chạm để thổi nến/i });
  await blowButton.click();
  await blowButton.click();
  await expect(page.locator('#gift-reveal-status')).toContainText(
    /một ánh sáng nhỏ luôn chuyển động cùng em/i,
  );
  await expect(page.locator('#gift-product-visual')).toBeVisible();
  await expect(page.locator('#cake-stage')).toHaveAttribute(
    'data-gift-renderer',
    'image',
  );
  await expect(page.locator('#cake-fallback .fallback-necklace')).toBeHidden();
  expect(
    await page.locator('#gift-product-visual picture').evaluate(element =>
      getComputedStyle(element).animationName,
    ),
  ).toBe('none');
  await expect(page.locator('.gift-product__stone-highlight')).toBeHidden();
  await page.getByRole('button', { name: /Mở những kỷ niệm/i }).click();

  await expect(page.getByRole('heading', { name: /Ký ức của chúng mình/i })).toBeVisible();
  await page.getByRole('button', { name: /Khép lại cuốn album/i }).click();
  await expect(page.getByRole('heading', { name: /Happy Birthday/i })).toBeVisible();

  await page.getByRole('button', { name: /Xem lại từ đầu/i }).click();
  await expect(page.getByRole('heading', { name: /Dành cho An/i })).toBeVisible();
  await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
  await page.getByRole('button', { name: /Ước một điều nhé/i }).click();
  await expect(page.locator('#cake-stage')).toHaveAttribute(
    'data-gift-state',
    'waiting',
  );
  await expect(page.locator('#gift-product-visual')).toBeHidden();
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test('tap fallback stays interactive while the 3D upgrade is still downloading', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'One Chromium production smoke test covers a deliberately stalled 3D chunk.',
  );

  let releaseThree;
  let threeRequested = false;
  const holdThree = new Promise(resolve => {
    releaseThree = resolve;
  });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
      if (String(type).startsWith('webgl')) return {};
      return original.call(this, type, ...args);
    };
  });
  await page.route(
    requestUrl => /(?:three\.module-|\/three\.js)/.test(requestUrl.pathname),
    async route => {
      threeRequested = true;
      await holdThree;
      await route.abort();
    },
  );

  try {
    await page.goto('./?age=1');
    await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
    await page.getByRole('button', { name: /Ước một điều nhé/i }).click();

    await expect.poll(() => threeRequested).toBe(true);
    await expect(page.locator('#cake-fallback')).toBeVisible();
    await page.getByRole('button', { name: /Chạm để thổi nến/i }).click();
    await expect(page.getByRole('button', { name: /Mở những kỷ niệm/i })).toBeVisible();
  } finally {
    releaseThree();
  }
});

test('the Three cake survives when the optional confetti chunk fails', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'One Chromium production smoke test covers an optional animation chunk failure.',
  );

  await page.goto('./?age=1');
  await page.route(
    requestUrl => requestUrl.pathname.includes('confetti.module'),
    route => route.abort(),
  );
  await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
  await page.getByRole('button', { name: /Ước một điều nhé/i }).click();

  await expect(page.locator('#cake-stage canvas')).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: /Chạm để thổi nến/i }).click();
  await expect(page.locator('#gift-product-visual')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Mở những kỷ niệm/i }),
  ).toBeVisible();
});

test('Back and Finish stay usable while the gallery chunk is stalled', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'One Chromium smoke test covers a deliberately stalled gallery chunk.',
  );

  let releaseGallery;
  let galleryRequested = false;
  const holdGallery = new Promise(resolve => {
    releaseGallery = resolve;
  });
  await page.route(
    requestUrl => requestUrl.pathname.includes('gallery-scene'),
    async route => {
      galleryRequested = true;
      await holdGallery;
      await route.abort();
    },
  );

  try {
    await page.goto('./');
    await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
    await page.getByRole('button', { name: /Đi thẳng đến những kỷ niệm/i }).click();

    await expect.poll(() => galleryRequested).toBe(true);
    await expect(page.getByRole('heading', { name: /Ký ức của chúng mình/i })).toBeVisible();
    await expect(page.locator('[data-scene="gallery"]')).not.toHaveAttribute('inert', '');
    await page.getByRole('button', { name: /Quay lại/i }).click();
    await expect(page.getByRole('heading', { name: /Một lá thư dành cho em/i })).toBeVisible();

    await page.getByRole('button', { name: /Đi thẳng đến những kỷ niệm/i }).click();
    await page.getByRole('button', { name: /Khép lại cuốn album/i }).click();
    await expect(page.getByRole('heading', { name: /Happy Birthday/i })).toBeVisible();
  } finally {
    releaseGallery();
  }
});

test('a failed gallery chunk offers a working update reload', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'One Chromium smoke test covers lazy-chunk deployment recovery.',
  );

  let failGallery = true;
  await page.route(
    requestUrl => requestUrl.pathname.includes('gallery-scene'),
    route => (failGallery ? route.abort() : route.continue()),
  );

  await page.goto('./');
  await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
  await page.getByRole('button', { name: /Đi thẳng đến những kỷ niệm/i }).click();
  await expect(page.locator('#gallery-load-error')).toBeVisible();

  failGallery = false;
  await page.getByRole('button', { name: /Tải lại phiên bản mới/i }).click();
  await expect(page.locator('#gallery-progress')).toHaveText('Trang 1 / 21');
});

test('the epilogue can download a postcard from the current memory', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'One Chromium smoke test verifies the generated download artifact.',
  );

  await page.goto('./?to=An&from=Minh');
  await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
  await page.getByRole('button', { name: /Đi thẳng đến những kỷ niệm/i }).click();
  await expect(page.locator('#gallery-progress')).toHaveText('Trang 1 / 21');
  await page.getByRole('button', { name: /Khép lại cuốn album/i }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Lưu một tấm postcard/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('birthday-keepsake.png');
});

test('the Swarovski product render appears after the final candle', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'One Chromium production smoke test covers the lazy gift reveal.',
  );

  const productRequests = [];
  page.on('request', request => {
    if (request.url().includes('swarovski-dancing-swan-5514421')) {
      productRequests.push(request.url());
    }
  });

  await page.goto('./?age=1');
  expect(productRequests).toEqual([]);
  await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
  await expect(
    page.getByRole('heading', { name: /Một lá thư dành cho em/i }),
  ).toBeVisible();
  expect(productRequests).toEqual([]);
  await page.getByRole('button', { name: /Ước một điều nhé/i }).click();
  await expect(page.locator('#cake-stage canvas')).toBeVisible({
    timeout: 15_000,
  });
  await expect
    .poll(() => productRequests.length)
    .toBeGreaterThan(0);

  await page.getByRole('button', { name: /Chạm để thổi nến/i }).click();

  await expect(page.locator('#cake-stage')).toHaveAttribute(
    'data-gift-state',
    'revealed',
  );
  await expect(page.locator('#cake-stage')).toHaveAttribute(
    'data-gift-renderer',
    'image',
  );
  await expect(page.locator('#gift-product-visual')).toBeVisible();
  await expect(page.locator('#gift-product-image')).toHaveAttribute(
    'alt',
    'Dây chuyền Swarovski Dancing Swan màu trắng, mạ rhodium, đính crystal và zirconia',
  );
  await expect
    .poll(() =>
      page.locator('#gift-product-image').evaluate(image => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.locator('#gift-reveal-status')).toContainText(
    /một ánh sáng nhỏ luôn chuyển động cùng em/i,
  );

  const initialStageHeight = await page
    .locator('#cake-stage')
    .evaluate(stage => stage.getBoundingClientRect().height);
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(page.locator('#gift-product-visual')).toBeVisible();
  expect(
    await page.locator('#gift-product-image').evaluate(image =>
      getComputedStyle(image).objectFit,
    ),
  ).toBe('contain');
  const mobileVisualBounds = await page
    .locator('#gift-product-visual')
    .evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
  expect(mobileVisualBounds.left).toBeGreaterThanOrEqual(0);
  expect(mobileVisualBounds.right).toBeLessThanOrEqual(
    mobileVisualBounds.viewportWidth,
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect
    .poll(() =>
      page
        .locator('#cake-stage')
        .evaluate(stage => stage.getBoundingClientRect().height),
    )
    .toBeLessThanOrEqual(initialStageHeight + 4);

  await page.getByRole('button', { name: /Quay lại/i }).click();
  await expect(
    page.getByRole('heading', { name: /Một lá thư dành cho em/i }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Ước một điều nhé/i }).click();
  await expect(page.locator('#cake-stage')).toHaveAttribute(
    'data-gift-state',
    'waiting',
  );
  await expect(page.locator('#gift-product-visual')).toBeHidden();
  await expect(page.locator('#candle-count')).toHaveText('1 ngọn nến còn lại');
});

test('a missing Swarovski render falls back to the SVG without blocking the gift', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'One Chromium production smoke test covers an intentionally missing product asset.',
  );

  await page.route('**/swarovski-dancing-swan-5514421.*', route =>
    route.abort(),
  );
  await page.goto('./?age=1');
  await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
  await page.getByRole('button', { name: /Ước một điều nhé/i }).click();
  await page.getByRole('button', { name: /Chạm để thổi nến/i }).click();

  await expect(page.locator('#cake-stage')).toHaveAttribute(
    'data-gift-renderer',
    '2d',
  );
  await expect(page.locator('#cake-fallback')).toHaveAttribute(
    'aria-hidden',
    'false',
  );
  await expect(
    page.getByRole('img', { name: /Dây chuyền thiên nga/i }),
  ).toBeVisible();
  await expect(page.locator('#cake-fallback .fallback-necklace')).toBeVisible();
  await expect(page.locator('#gift-product-visual')).toBeHidden();
  await page.getByRole('button', { name: /Mở những kỷ niệm/i }).click();
  await expect(
    page.getByRole('heading', { name: /Ký ức của chúng mình/i }),
  ).toBeVisible();
});

test('a delayed Swarovski render upgrades the fallback after Back and re-entry', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'One Chromium production smoke test covers the cross-entry image race.',
  );

  let releaseProductRequest;
  let heldRequests = 0;
  const productGate = new Promise(resolve => {
    releaseProductRequest = resolve;
  });
  await page.route('**/swarovski-dancing-swan-5514421.*', async route => {
    heldRequests += 1;
    await productGate;
    await route.continue();
  });

  try {
    await page.goto('./?age=1');
    await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
    await page.getByRole('button', { name: /Ước một điều nhé/i }).click();
    await expect.poll(() => heldRequests).toBeGreaterThan(0);

    await page.getByRole('button', { name: /Quay lại/i }).click();
    await page.getByRole('button', { name: /Ước một điều nhé/i }).click();
    await page.getByRole('button', { name: /Chạm để thổi nến/i }).click();
    await expect(page.locator('#cake-stage')).toHaveAttribute(
      'data-gift-renderer',
      '2d',
    );

    releaseProductRequest();
    await expect(page.locator('#gift-product-visual')).toBeVisible();
    await expect(page.locator('#cake-stage')).toHaveAttribute(
      'data-gift-renderer',
      'image',
    );
  } finally {
    releaseProductRequest();
  }
});

test('camera resumes after a hidden tab and stops when leaving the cake scene', async ({
  page,
}) => {
  await page.addInitScript(() => {
    globalThis.__cameraStarts = 0;
    globalThis.__cameraTrackStops = 0;
    globalThis.__detectorCloses = 0;
    const originalCanvasContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
      if (String(type).startsWith('webgl')) return null;
      return originalCanvasContext.call(this, type, ...args);
    };

    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      get() {
        return this.__testStream || null;
      },
      set(value) {
        this.__testStream = value;
      },
    });
    HTMLMediaElement.prototype.play = async () => {};

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          globalThis.__cameraStarts += 1;
          return {
            getTracks: () => [
              {
                stop: () => {
                  globalThis.__cameraTrackStops += 1;
                },
              },
            ],
          };
        },
      },
    });

    globalThis.Hands = class FakeHands {
      frame = 0;
      setOptions() {}
      onResults(callback) {
        this.callback = callback;
      }
      async send() {
        const landmarks = Array.from({ length: 9 }, () => ({ x: 0.4, y: 0.4 }));
        landmarks[8] = {
          x: this.frame % 2 === 0 ? 0.1 : 0.9,
          y: 0.4,
        };
        this.frame += 1;
        this.callback({ multiHandLandmarks: [landmarks] });
      }
      close() {
        globalThis.__detectorCloses += 1;
      }
    };
  });

  await page.goto('./?age=1');
  await expect.poll(() => page.evaluate(() => globalThis.__cameraTrackStops)).toBe(0);
  await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
  await page.getByRole('button', { name: /Ước một điều nhé/i }).click();

  await page.getByRole('button', { name: /Dùng cử chỉ/i }).click();
  await expect(page.locator('#camera-preview')).toBeVisible();
  await expect(page.locator('#camera-status')).toContainText(/Camera đã bật|Đã thấy|tìm bàn tay/i);
  await expect(page.getByRole('button', { name: /Mở những kỷ niệm/i })).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => globalThis.__cameraTrackStops)).toBe(1);
  expect(await page.evaluate(() => globalThis.__detectorCloses)).toBe(1);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#camera-preview')).toBeVisible();
  await expect.poll(() => page.evaluate(() => globalThis.__cameraStarts)).toBe(2);

  await page.getByRole('button', { name: /Mở những kỷ niệm/i }).click();
  await expect(page.getByRole('heading', { name: /Ký ức/i })).toBeVisible();

  expect(await page.evaluate(() => globalThis.__cameraTrackStops)).toBe(2);
  expect(await page.evaluate(() => globalThis.__detectorCloses)).toBe(2);
});

test('back, skip, chapter navigation, keyboard controls, and the lightbox stay usable', async ({
  page,
}) => {
  await page.goto('./?age=1');
  await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
  await page.getByRole('button', { name: /Quay lại/i }).click();
  await expect(page.getByRole('heading', { name: /Dành cho/i })).toBeVisible();

  await page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }).click();
  await page.getByRole('button', { name: /Đi thẳng đến những kỷ niệm/i }).click();

  const chapterNavigation = page.getByRole('navigation', {
    name: /Các chương kỷ niệm/i,
  });
  await expect(chapterNavigation.getByRole('button')).toHaveCount(3);
  await expect(page.locator('#gallery-progress')).toHaveText('Trang 1 / 21');
  await expect
    .poll(() =>
      page
        .locator('.memory-photo')
        .evaluateAll(buttons => buttons.filter(button => button.tabIndex === 0).length),
    )
    .toBe(1);

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#gallery-progress')).toHaveText('Trang 2 / 21');

  const photoButton = page.getByRole('button', { name: /Mở ảnh: Memory 2/i });
  await photoButton.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#lightbox-counter')).toHaveText('2 / 21');
  await expect(page.locator('#lightbox-close')).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#lightbox-counter')).toHaveText('3 / 21');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: /Mở ảnh: Memory 3/i })).toBeFocused();
  await expect(page.locator('#gallery-progress')).toHaveText('Trang 3 / 21');

  const viewport = page.locator('#scrapbook-viewport');
  const box = await viewport.boundingBox();
  if (!box) throw new Error('Gallery viewport is not visible');
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(page.locator('#gallery-progress')).toHaveText('Trang 4 / 21');

  await chapterNavigation.getByRole('button', { name: 'Nắng trong ngày thường' }).click();
  await expect(page.locator('#gallery-progress')).toHaveText('Trang 8 / 21');
});
