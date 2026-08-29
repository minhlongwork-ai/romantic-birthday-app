import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  resolveOpenGraphAsset,
  validateEditorialContent,
} from '../../scripts/validate-source.mjs';

const giftUrl = new URL('../../src/content/gift.json', import.meta.url);

test('Birthday editorial content has 21 reviewed Vietnamese memories', async () => {
  const gift = JSON.parse(await readFile(giftUrl, 'utf8'));
  assert.deepEqual(validateEditorialContent(gift), []);
  assert.equal(gift.memories.length, 21);
});

test('editorial validation rejects placeholder alt text and untranslated card copy', () => {
  const gift = {
    sender: { name: 'Yours Truly' },
    letter: {
      greeting: 'Dear {{recipient}},',
      paragraphs: ['Happy Birthday'],
      closing: 'Yours Truly',
    },
    epilogue: { heading: 'Happy Birthday', message: 'Always and forever' },
    memories: Array.from({ length: 21 }, (_, index) => ({
      id: `memory-${index + 1}`,
      alt: `Memory ${index + 1}`,
      caption: 'Captured happiness',
      chapter: 'Chapter',
    })),
  };
  const errors = validateEditorialContent(gift).join('\n');
  assert.match(errors, /Vietnamese/i);
  assert.match(errors, /placeholder alt/i);
});

test('Open Graph source ownership follows a synthetic registry record', () => {
  const rootDir = resolve(tmpdir(), 'experience-source-owner');
  const syntheticSite = {
    experiences: [{
      id: 'october',
      route: '/october/',
      preview: {
        source: 'apps/october/public/images/preview.webp',
        publicPath: '/experience-previews/october.webp',
        width: 1600,
        height: 900,
      },
      build: {
        config: 'apps/october/vite.config.js',
        copies: [{
          source: 'apps/october/public',
          destination: 'october/public',
        }],
      },
    }],
  };

  assert.deepEqual(
    resolveOpenGraphAsset(
      syntheticSite,
      '/october/public/images/og-card.jpg',
      { rootDir },
    ),
    {
      filePath: resolve(rootDir, 'apps/october/public/images/og-card.jpg'),
      width: 1200,
      height: 630,
    },
  );
  assert.deepEqual(
    resolveOpenGraphAsset(
      syntheticSite,
      '/experience-previews/october.webp',
      { rootDir },
    ),
    {
      filePath: resolve(rootDir, 'apps/october/public/images/preview.webp'),
      width: 1600,
      height: 900,
    },
  );
});
