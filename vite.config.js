import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

import { createSiteMetadataPlugin } from './scripts/site-metadata.mjs';

const site = JSON.parse(
  readFileSync(new URL('./src/content/site.json', import.meta.url), 'utf8'),
);

export default defineConfig({
  base: '/birthday/',
  plugins: [createSiteMetadataPlugin(site, 'birthday')],
  build: {
    manifest: true,
    target: 'es2022',
  },
});
