import { expect, test } from '@playwright/test';
import sharp from 'sharp';

const syntheticPortrait = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0k0AAAAASUVORK5CYII=',
  'base64',
);

test('August photo stays local, exports 1200×1500, and replay disposes resources', async ({
  baseURL,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'One deterministic Chromium run covers local image privacy and PNG export.',
  );

  await page.addInitScript(() => {
    globalThis.__photoPrivacy = {
      created: [],
      revoked: [],
      bitmapCloses: 0,
      bitmapCreates: 0,
      bitmapSupported: Boolean(globalThis.ImageBitmap?.prototype?.close),
      mutations: [],
    };
    const originalCreate = URL.createObjectURL.bind(URL);
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = value => {
      const url = originalCreate(value);
      globalThis.__photoPrivacy.created.push(url);
      return url;
    };
    URL.revokeObjectURL = url => {
      globalThis.__photoPrivacy.revoked.push(url);
      return originalRevoke(url);
    };
    if (typeof globalThis.createImageBitmap === 'function') {
      const originalCreateImageBitmap = globalThis.createImageBitmap.bind(globalThis);
      globalThis.createImageBitmap = async (...args) => {
        const bitmap = await originalCreateImageBitmap(...args);
        globalThis.__photoPrivacy.bitmapCreates += 1;
        const originalClose = bitmap.close.bind(bitmap);
        try {
          Object.defineProperty(bitmap, 'close', {
            configurable: true,
            value() {
              globalThis.__photoPrivacy.bitmapCloses += 1;
              return originalClose();
            },
          });
        } catch {
          // A non-extensible native ImageBitmap is still covered by the unit disposal test.
          globalThis.__photoPrivacy.bitmapSupported = false;
        }
        return bitmap;
      };
    }
    const originalFetch = globalThis.fetch?.bind(globalThis);
    if (originalFetch) {
      globalThis.fetch = (input, init = {}) => {
        const method = String(init.method || 'GET').toUpperCase();
        if (!['GET', 'HEAD'].includes(method) || init.body != null) {
          globalThis.__photoPrivacy.mutations.push(`fetch:${method}`);
        }
        return originalFetch(input, init);
      };
    }
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function open(method, ...args) {
      this.__privacyMethod = String(method || 'GET').toUpperCase();
      return originalOpen.call(this, method, ...args);
    };
    XMLHttpRequest.prototype.send = function send(body) {
      if (!['GET', 'HEAD'].includes(this.__privacyMethod) || body != null) {
        globalThis.__photoPrivacy.mutations.push(`xhr:${this.__privacyMethod}`);
      }
      return originalSend.call(this, body);
    };
    const originalBeacon = navigator.sendBeacon?.bind(navigator);
    if (originalBeacon) {
      navigator.sendBeacon = (...args) => {
        globalThis.__photoPrivacy.mutations.push('beacon');
        return originalBeacon(...args);
      };
    }
    const OriginalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = class PrivacyWebSocket extends OriginalWebSocket {
      constructor(...args) {
        globalThis.__photoPrivacy.mutations.push('websocket');
        super(...args);
      }
    };
    for (const method of ['submit', 'requestSubmit']) {
      const original = HTMLFormElement.prototype[method];
      if (!original) continue;
      HTMLFormElement.prototype[method] = function submit(...args) {
        globalThis.__photoPrivacy.mutations.push(`form:${method}`);
        return original.apply(this, args);
      };
    }
  });

  const requestsAfterUpload = [];
  let trackingRequests = false;
  page.on('request', request => {
    if (trackingRequests) {
      requestsAfterUpload.push({
        method: request.method(),
        postData: request.postData(),
        url: request.url(),
      });
    }
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(new URL('../august/?to=Em&from=Shyn', baseURL).href);
  await page.getByRole('button', { name: 'Mở thư', exact: true }).click();
  await page.getByRole('button', { name: /Xem điều dành cho em/i }).click();
  await page.getByRole('radio').first().click();
  await page.getByRole('button', { name: /Mang điều này theo/i }).click();

  trackingRequests = true;
  await page.locator('[data-library-input]').setInputFiles({
    name: 'privacy-grid.png',
    mimeType: 'image/png',
    buffer: syntheticPortrait,
  });
  await expect(page.locator('section[data-scene="photo-editor"]')).toBeVisible();
  await page.getByRole('button', { name: /Dùng ảnh này/i }).click();
  await expect(page.getByRole('heading', { name: /Đặt những cành hoa/i })).toBeVisible();
  await page.getByRole('button', { name: /Ép hoa/i }).click();
  await expect(page.getByRole('heading', { name: /Một ngày tháng tám/i })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Lưu bưu thiếp/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('thang-tam-o-lai.png');
  const outputPath = await download.path();
  const metadata = await sharp(outputPath).metadata();
  expect({ width: metadata.width, height: metadata.height }).toEqual({
    width: 1200,
    height: 1500,
  });

  const origin = new URL(baseURL).origin;
  expect(requestsAfterUpload.every(request => {
    const url = new URL(request.url);
    return url.origin === origin
      && ['GET', 'HEAD'].includes(request.method)
      && request.postData === null;
  })).toBe(true);

  await page.getByRole('button', { name: /Xem lại từ đầu/i }).click();
  await expect(page.getByRole('heading', { name: /Gửi em, một tháng tám/i })).toBeVisible();
  await page.waitForTimeout(1_100);
  const privacy = await page.evaluate(() => globalThis.__photoPrivacy);
  expect(privacy.created.length).toBeGreaterThan(0);
  expect(new Set(privacy.revoked)).toEqual(new Set(privacy.created));
  expect(privacy.mutations).toEqual([]);
  if (privacy.bitmapSupported) expect(privacy.bitmapCloses).toBe(privacy.bitmapCreates);
});
