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
