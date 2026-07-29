import { expect, test } from '@playwright/test';

test('the production app shell reloads offline after its first visit', async ({
  browserName,
  context,
  page,
}) => {
  test.skip(
    !process.env.CI || browserName !== 'chromium',
    'The production service-worker smoke test runs once on Chromium.',
  );

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, {
          once: true,
        });
      });
    }
  });

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { name: /Dành cho/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tiếp tục trong yên lặng/i })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
