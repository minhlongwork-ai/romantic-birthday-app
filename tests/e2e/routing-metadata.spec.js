import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { contentTypeMatches } from '../../scripts/validate-build.mjs';

const productionOrigin = 'https://romantic-birthday-app.vercel.app';
const [catalog, siteShell] = await Promise.all([
  readFile(new URL('../../src/content/experiences.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../../src/content/site.json', import.meta.url), 'utf8').then(JSON.parse),
]);

test('registry routes have metadata in preview and draft routes use the shared production 404', async ({
  baseURL,
  page,
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'One browser validates deployment routing and the public manifest.',
  );

  const localOrigin = new URL(baseURL).origin;
  const manifestResponse = await request.get(new URL('/build-manifest.json', localOrigin).href);
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  const builtExperienceIds = manifest.catalog
    .filter(({ built }) => built)
    .map(({ id }) => id)
    .sort();
  const allExperienceIds = catalog.map(({ id }) => id).sort();
  const publishedExperienceIds = catalog
    .filter(({ status }) => status === 'published')
    .map(({ id }) => id)
    .sort();
  const isPreviewArtifact = JSON.stringify(builtExperienceIds) === JSON.stringify(allExperienceIds);

  if (!isPreviewArtifact) {
    expect(builtExperienceIds).toEqual(publishedExperienceIds);
  }
  expect(manifest.externalRuntimeUrls).toEqual([]);

  const pages = [
    { id: 'chooser', route: '/', metadata: siteShell.chooser, built: true },
    ...catalog.map(experience => ({
      id: experience.id,
      route: experience.route,
      metadata: experience.metadata,
      built: isPreviewArtifact || experience.status === 'published',
      previewPublicPath: experience.preview.publicPath,
    })),
  ];

  for (const experience of pages) {
    const response = await page.goto(new URL(experience.route, localOrigin).href);
    expect(response?.status()).toBe(experience.built ? 200 : 404);

    if (!experience.built) {
      await expect(page.getByRole('heading', {
        name: /Trang này không có trong cuốn thiệp/i,
      })).toBeVisible();
      continue;
    }

    const canonical = new URL(experience.route, productionOrigin).href;
    const ogImage = new URL(experience.metadata.ogImage, productionOrigin).href;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', ogImage);
  }

  if (!isPreviewArtifact) {
    const draftExperiences = catalog.filter(({ status }) => status !== 'published');
    await page.goto(new URL('/', localOrigin).href);
    for (const experience of draftExperiences) {
      const card = page.locator(`.gift-card-${experience.id}`);
      await expect(card).toHaveAttribute('aria-disabled', 'true');
      await expect(card).not.toHaveAttribute('href');
      const previewResponse = await request.get(
        new URL(experience.preview.publicPath, localOrigin).href,
      );
      expect(previewResponse.status()).toBe(200);
    }
  }

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
  await expect(page.getByRole('heading', {
    name: /Trang này không có trong cuốn thiệp/i,
  })).toBeVisible();
});
