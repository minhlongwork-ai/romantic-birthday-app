import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildCanonicalUrl,
  composeSiteConfig,
  loadSiteConfig,
  validateSiteConfig,
} from '../../scripts/site-config.mjs';

const siteShell = JSON.parse(
  await readFile(new URL('../../src/content/site.json', import.meta.url), 'utf8'),
);

test('site routes and metadata are derived from the registry', async () => {
  const site = await loadSiteConfig();
  assert.deepEqual(site.routes, {
    chooser: '/', birthday: '/birthday/', august: '/august/', september: '/september/',
  });
  assert.equal(site.shareTargets.september, '/september/');
  assert.equal(site.pages.september.title, 'Một chút ngọt, một chút hoa');
  assert.deepEqual(validateSiteConfig(site), []);
});

test('site config preserves the canonical Vercel origin for every public route', async () => {
  const site = await loadSiteConfig();
  assert.equal(site.origin, 'https://thiep-cho-em.vercel.app');
  assert.equal(buildCanonicalUrl(site, 'chooser'), site.origin + '/');
  assert.equal(
    buildCanonicalUrl(site, 'birthday'),
    site.origin + '/birthday/',
  );
  assert.equal(
    buildCanonicalUrl(site, 'august'),
    site.origin + '/august/',
  );
  assert.equal(
    buildCanonicalUrl(site, 'september'),
    site.origin + '/september/',
  );
  assert.equal(site.shareTargets.september, site.routes.september);
});

test('composing a cloned experience updates its route and metadata', async () => {
  const site = await loadSiteConfig();
  const experiences = structuredClone(site.experiences);
  const september = experiences.find(({ id }) => id === 'september');
  september.route = '/october/';
  september.metadata.title = 'Tháng Mười mới';

  const composed = composeSiteConfig(siteShell, experiences);
  assert.equal(composed.routes.september, '/october/');
  assert.equal(composed.shareTargets.september, '/october/');
  assert.equal(composed.pages.september.title, 'Tháng Mười mới');
});

test('site config rejects personalized, external, or incomplete route targets', async () => {
  const invalid = structuredClone(await loadSiteConfig());
  invalid.routes.birthday = '/birthday/?to=Em';
  invalid.shareTargets.august = 'https://example.com/august/';
  delete invalid.routes.chooser;

  const errors = validateSiteConfig(invalid);
  assert.ok(errors.some(error => error.includes('routes.chooser')));
  assert.ok(errors.some(error => error.includes('routes.birthday')));
  assert.ok(errors.some(error => error.includes('shareTargets.august')));
});

test('Vercel production uses the environment-aware September release gate', async () => {
  const config = JSON.parse(
    await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'),
  );
  assert.equal(config.buildCommand, 'npm run build:vercel');
});
