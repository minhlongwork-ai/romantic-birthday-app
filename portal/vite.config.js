import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { createExperienceCatalogPlugin } from './experience-catalog-plugin.mjs';
import { loadExperienceRegistry } from '../scripts/experience-registry.mjs';
import { createSiteMetadataPlugin } from '../scripts/site-metadata.mjs';

const [records, site] = await Promise.all([
  loadExperienceRegistry(),
  readFile(new URL('../src/content/site.json', import.meta.url), 'utf8').then(JSON.parse),
]);

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/',
  publicDir: false,
  plugins: [
    createExperienceCatalogPlugin(records),
    createSiteMetadataPlugin(site, 'chooser'),
  ],
  build: {
    target: 'es2022',
  },
});
