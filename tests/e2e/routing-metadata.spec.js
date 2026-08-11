import { expect, test } from '@playwright/test';

import { contentTypeMatches } from '../../scripts/validate-build.mjs';

const productionOrigin = 'https://romantic-birthday-app.vercel.app';

test('canonical routes, metadata, critical assets, and custom 404 are deploy-safe', async ({
  baseURL,
  page,
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'One browser validates deployment routing and the public manifest.',
  );
  const localOrigin = new URL(baseURL).origin;
  const routes = [
    ['/', `${productionOrigin}/`],
    ['/birthday/', `${productionOrigin}/birthday/`],
    ['/august/', `${productionOrigin}/august/`],
  ];

  for (const [path, canonical] of routes) {
    const response = await page.goto(new URL(path, localOrigin).href);
    expect(response?.status()).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      `${productionOrigin}/birthday/og-preview.jpg`,
    );
  }

  const manifestResponse = await request.get(new URL('/build-manifest.json', localOrigin).href);
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest.externalRuntimeUrls).toEqual([]);
  for (const asset of manifest.assets.filter(candidate => candidate.critical)) {
    const head = await request.head(new URL(asset.url, localOrigin).href);
    expect(head.status(), asset.url).toBe(200);
    const get = await request.get(new URL(asset.url, localOrigin).href);
    expect(get.status(), asset.url).toBe(200);
    expect(contentTypeMatches(
      asset.contentType,
      get.headers()['content-type'] || '',
    )).toBe(true);
  }

  const notFound = await page.goto(new URL('/not-a-real-route', localOrigin).href);
  expect(notFound?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /Trang này không có trong cuốn thiệp/i })).toBeVisible();
});
