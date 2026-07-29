import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const gift = JSON.parse(
  readFileSync(new URL('./src/content/gift.json', import.meta.url), 'utf8'),
);
const publicUrl = new URL(gift.sharing.publicUrl).href;
const socialPreviewUrl = new URL('og-preview.jpg', publicUrl).href;

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'gift-safe-sharing-metadata',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          return html
            .replaceAll('%GIFT_PUBLIC_URL%', publicUrl)
            .replaceAll('%GIFT_OG_IMAGE_URL%', socialPreviewUrl);
        },
      },
    },
  ],
  build: {
    manifest: true,
    target: 'es2022',
  },
});
