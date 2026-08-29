import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { createExperienceCatalogPlugin } from './experience-catalog-plugin.mjs';
import { loadSiteConfig } from '../scripts/site-config.mjs';
import { createSiteMetadataPlugin } from '../scripts/site-metadata.mjs';

const site = await loadSiteConfig();

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/',
  publicDir: false,
  plugins: [
    createExperienceCatalogPlugin(site.experiences),
    createSiteMetadataPlugin(site, 'chooser'),
  ],
  build: {
    target: 'es2022',
  },
});
