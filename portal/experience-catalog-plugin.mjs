import { renderExperienceCatalog } from './experience-catalog.mjs';

const CATALOG_MARKER = '<!-- EXPERIENCE_CATALOG -->';

export function applyExperienceCatalog(html, records) {
  if (html.split(CATALOG_MARKER).length !== 2) {
    throw new Error('portal/index.html must contain exactly one EXPERIENCE_CATALOG marker.');
  }

  return html.replace(CATALOG_MARKER, renderExperienceCatalog(records));
}

export function createExperienceCatalogPlugin(records) {
  return {
    name: 'experience-catalog',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return applyExperienceCatalog(html, records);
      },
    },
  };
}
