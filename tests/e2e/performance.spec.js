import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('the median of five cold intro LCP samples stays within the mobile 4G budget', async ({
  baseURL,
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'Chromium CDP provides the deterministic network throttling for this budget.',
  );

  const samples = [];
  for (let sample = 0; sample < 5; sample += 1) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
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

    await page.goto(baseURL, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await expect
      .poll(() => page.evaluate(() => globalThis.__largestContentfulPaint))
      .toBeGreaterThan(0);
    samples.push(await page.evaluate(() => globalThis.__largestContentfulPaint));
    await context.close();
  }

  samples.sort((left, right) => left - right);
  expect(samples[2], `cold LCP samples: ${samples.join(', ')}`).toBeLessThanOrEqual(2_500);
  expect(samples[4], `cold LCP samples: ${samples.join(', ')}`).toBeLessThanOrEqual(3_000);
});
