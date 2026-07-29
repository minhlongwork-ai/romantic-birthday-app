import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('the intro LCP stays within the mobile 4G budget', async ({
  context,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'Chromium CDP provides the deterministic network throttling for this budget.',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    connectionType: 'cellular4g',
  });
  await page.addInitScript(() => {
    globalThis.__largestContentfulPaint = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        globalThis.__largestContentfulPaint = entry.startTime;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  await page.goto('./', { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect
    .poll(() => page.evaluate(() => globalThis.__largestContentfulPaint))
    .toBeGreaterThan(0);

  const lcp = await page.evaluate(() => globalThis.__largestContentfulPaint);
  expect(lcp).toBeLessThanOrEqual(2_500);
});
