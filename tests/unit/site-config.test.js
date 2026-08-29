import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildCanonicalUrl,
  validateSiteConfig,
} from '../../scripts/site-config.mjs';

const siteConfig = JSON.parse(
  await readFile(new URL('../../src/content/site.json', import.meta.url), 'utf8'),
);

test('site.json is the single canonical Vercel origin for every public route', () => {
  assert.deepEqual(validateSiteConfig(siteConfig), []);
  assert.equal(siteConfig.origin, 'https://romantic-birthday-app.vercel.app');
  assert.equal(buildCanonicalUrl(siteConfig, 'chooser'), siteConfig.origin + '/');
  assert.equal(
    buildCanonicalUrl(siteConfig, 'birthday'),
    siteConfig.origin + '/birthday/',
  );
  assert.equal(
    buildCanonicalUrl(siteConfig, 'august'),
    siteConfig.origin + '/august/',
  );
  assert.equal(
    buildCanonicalUrl(siteConfig, 'september'),
    siteConfig.origin + '/september/',
  );
  assert.equal(
    siteConfig.shareTargets.september,
    siteConfig.routes.september,
  );
});

test('site config rejects personalized, external, or incomplete route targets', () => {
  const invalid = structuredClone(siteConfig);
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
