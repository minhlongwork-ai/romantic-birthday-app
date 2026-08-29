import { defineConfig } from 'vite';

import { loadSiteConfig } from './scripts/site-config.mjs';
import { createSiteMetadataPlugin } from './scripts/site-metadata.mjs';

const site = await loadSiteConfig();

export default defineConfig({
  base: '/birthday/',
  plugins: [createSiteMetadataPlugin(site, 'birthday')],
  build: {
    manifest: true,
    target: 'es2022',
  },
});
