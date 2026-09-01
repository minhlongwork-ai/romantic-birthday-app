import assert from 'node:assert/strict';
import test from 'node:test';

import { loadSiteConfig } from '../../scripts/site-config.mjs';
import {
  applySiteMetadata,
  createMetadataValues,
} from '../../scripts/site-metadata.mjs';

test('metadata values resolve from registry-derived site config without route-specific URL literals', async () => {
  const site = await loadSiteConfig();
  const values = createMetadataValues(site, 'birthday');
  assert.equal(values.canonicalUrl, 'https://romantic-birthday-app.vercel.app/birthday/');
  assert.equal(values.ogImageUrl, 'https://romantic-birthday-app.vercel.app/birthday/og-preview.jpg');
  assert.equal(values.title, 'Một cuốn album dành cho em');

  const september = createMetadataValues(site, 'september');
  assert.equal(
    september.canonicalUrl,
    'https://romantic-birthday-app.vercel.app/september/',
  );
  assert.equal(
    september.ogImageUrl,
    'https://romantic-birthday-app.vercel.app/september/images/preview.webp',
  );
  assert.equal(september.title, 'Một chút ngọt, một chút hoa');
  assert.equal(
    september.description,
    'Một hộp quà nhỏ với hai bất ngờ, được chuẩn bị riêng cho em.',
  );
  assert.equal(september.ogTitle, 'Một chút ngọt, một chút hoa');
  assert.equal(
    september.ogDescription,
    'Mở hộp theo thứ tự em chọn và khám phá điều anh gửi gắm.',
  );
});

test('metadata placeholders are completely resolved for every route', async () => {
  const site = await loadSiteConfig();
  const template = [
    '<title>%SITE_TITLE%</title>',
    '<meta name="description" content="%SITE_DESCRIPTION%">',
    '<meta property="og:title" content="%SITE_OG_TITLE%">',
    '<meta property="og:description" content="%SITE_OG_DESCRIPTION%">',
    '<meta property="og:url" content="%SITE_CANONICAL_URL%">',
    '<meta property="og:image" content="%SITE_OG_IMAGE_URL%">',
    '<link rel="canonical" href="%SITE_CANONICAL_URL%">',
  ].join('');

  for (const routeId of ['chooser', 'birthday', 'august', 'september']) {
    const html = applySiteMetadata(template, site, routeId);
    assert.doesNotMatch(html, /%SITE_[A-Z_]+%/);
    assert.match(html, new RegExp(site.origin.replaceAll('.', '\\.')));
  }
});
