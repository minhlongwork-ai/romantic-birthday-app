import { buildCanonicalUrl, validateSiteConfig } from './site-config.mjs';

const PLACEHOLDERS = Object.freeze({
  title: '%SITE_TITLE%',
  description: '%SITE_DESCRIPTION%',
  ogTitle: '%SITE_OG_TITLE%',
  ogDescription: '%SITE_OG_DESCRIPTION%',
  canonicalUrl: '%SITE_CANONICAL_URL%',
  ogImageUrl: '%SITE_OG_IMAGE_URL%',
});

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createMetadataValues(site, routeId) {
  const errors = validateSiteConfig(site);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const page = site.pages[routeId];
  if (!page) throw new Error(`Unknown metadata route: ${routeId}`);
  return {
    title: page.title,
    description: page.description,
    ogTitle: page.ogTitle,
    ogDescription: page.ogDescription,
    canonicalUrl: buildCanonicalUrl(site, routeId),
    ogImageUrl: new URL(page.ogImage, site.origin).href,
  };
}

export function applySiteMetadata(html, site, routeId) {
  const values = createMetadataValues(site, routeId);
  return Object.entries(PLACEHOLDERS).reduce(
    (result, [key, placeholder]) => result.replaceAll(
      placeholder,
      escapeHtml(values[key]),
    ),
    html,
  );
}

export function createSiteMetadataPlugin(site, routeId) {
  return {
    name: `site-metadata-${routeId}`,
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return applySiteMetadata(html, site, routeId);
      },
    },
  };
}
