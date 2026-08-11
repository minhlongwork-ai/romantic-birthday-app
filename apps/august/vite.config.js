import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { createSiteMetadataPlugin } from '../../scripts/site-metadata.mjs';

const site = JSON.parse(
  readFileSync(new URL('../../src/content/site.json', import.meta.url), 'utf8'),
);

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/august/',
  publicDir: false,
  plugins: [createSiteMetadataPlugin(site, 'august')],
  build: {
    target: 'es2022',
  },
});
