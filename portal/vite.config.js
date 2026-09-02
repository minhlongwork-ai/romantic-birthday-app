import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { createExperienceCatalogPlugin } from './experience-catalog-plugin.mjs';
import { loadSiteConfig } from '../scripts/site-config.mjs';
import { createSiteMetadataPlugin } from '../scripts/site-metadata.mjs';

const site = await loadSiteConfig();
const allowDraftInteraction = process.env.VERCEL_ENV !== 'production'
  && process.env.EXPERIENCE_BUILD_ENV !== 'production';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/',
  publicDir: false,
  plugins: [
    createExperienceCatalogPlugin(site.experiences, { allowDraftInteraction }),
    createSiteMetadataPlugin(site, 'chooser'),
  ],
  build: {
    target: 'es2022',
  },
});
