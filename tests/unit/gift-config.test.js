import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import {
  normalizeGiftConfig,
  validateGiftConfig,
} from '../../src/lib/gift-config.js';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const giftRevealFixture = {
  productName: 'Swarovski Dancing Swan',
  articleNumber: '5514421',
  src: '/images/swarovski-dancing-swan-5514421.jpg',
  alt: 'Dây chuyền Swarovski Dancing Swan màu trắng, mạ rhodium, đính crystal và zirconia',
  caption: 'Món quà đã mở: một ánh sáng nhỏ luôn chuyển động cùng em.',
};

function runValidator(...args) {
  return spawnSync(
    process.execPath,
    ['scripts/validate-gift.mjs', ...args],
    {
      cwd: projectRoot,
      encoding: 'utf8',
    },
  );
}

test('normalizeGiftConfig returns a trimmed copy of gift content', () => {
  const raw = {
    recipient: { name: '  Thuy Hien  ', age: 23 },
    sender: { name: '  Yours Truly  ' },
    letter: {
      greeting: '  Dear {{recipient}},  ',
      paragraphs: ['  First paragraph.  ', '  Second paragraph.  '],
      closing: '  — {{sender}}  ',
    },
    epilogue: {
      heading: '  Happy Birthday  ',
      message: '  Happy Birthday, always & forever 💖  ',
    },
    giftReveal: {
      productName: '  Swarovski Dancing Swan  ',
      articleNumber: '  5514421  ',
      src: '  /images/swarovski-dancing-swan-5514421.jpg  ',
      alt: '  Dây chuyền Swarovski Dancing Swan màu trắng  ',
      caption: '  Một ánh sáng nhỏ luôn chuyển động cùng em.  ',
    },
    soundtrack: {
      src: '  /audio.mp3  ',
      title: '  Ed Sheeran - Perfect  ',
      loop: true,
      lyrics: [{ time: 0, text: '  ♪ Perfect ♪  ' }],
    },
    features: {
      cameraGestures: true,
      manualPhotoUpload: false,
      lyrics: true,
      postcard: true,
      voiceNote: false,
    },
    memories: [{
      id: '  memory-01  ',
      src: '  /images/1.jpg  ',
      alt: '  Memory 1  ',
      caption: '  Every moment with you is a treasure ✨  ',
    }],
  };

  const normalized = normalizeGiftConfig(raw);

  assert.deepEqual(normalized, {
    recipient: { name: 'Thuy Hien', age: 23 },
    sender: { name: 'Yours Truly' },
    letter: {
      greeting: 'Dear {{recipient}},',
      paragraphs: ['First paragraph.', 'Second paragraph.'],
      closing: '— {{sender}}',
    },
    epilogue: {
      heading: 'Happy Birthday',
      message: 'Happy Birthday, always & forever 💖',
    },
    giftReveal: {
      productName: 'Swarovski Dancing Swan',
      articleNumber: '5514421',
      src: '/images/swarovski-dancing-swan-5514421.jpg',
      alt: 'Dây chuyền Swarovski Dancing Swan màu trắng',
      caption: 'Một ánh sáng nhỏ luôn chuyển động cùng em.',
    },
    soundtrack: {
      src: '/audio.mp3',
      title: 'Ed Sheeran - Perfect',
      loop: true,
      lyrics: [{ time: 0, text: '♪ Perfect ♪' }],
    },
    features: {
      cameraGestures: true,
      manualPhotoUpload: false,
      lyrics: true,
      postcard: true,
      voiceNote: false,
    },
    memories: [{
      id: 'memory-01',
      src: '/images/1.jpg',
      alt: 'Memory 1',
      caption: 'Every moment with you is a treasure ✨',
    }],
  });
  assert.notStrictEqual(normalized, raw);
  assert.equal(raw.recipient.name, '  Thuy Hien  ');
});

test('normalizeGiftConfig applies bounded URL overrides and clamps age', () => {
  const raw = {
    recipient: { name: 'Thuy Hien', age: 23 },
    sender: { name: 'Yours Truly' },
    letter: { greeting: 'Dear', paragraphs: ['Happy birthday'], closing: 'With love' },
    epilogue: { heading: 'Happy Birthday', message: 'Always & forever' },
    giftReveal: giftRevealFixture,
    soundtrack: { src: '/audio.mp3', title: 'Perfect', loop: true, lyrics: [] },
    features: {
      cameraGestures: true,
      manualPhotoUpload: false,
      lyrics: true,
      postcard: true,
      voiceNote: false,
    },
    memories: [],
  };
  const unsafeName = `<b>${'A'.repeat(100)}</b>`;
  const search = new URLSearchParams({
    to: `  ${unsafeName}\u0000  `,
    age: '999',
    from: '  Minh   Long  ',
  }).toString();

  const normalized = normalizeGiftConfig(raw, `?${search}`);

  assert.equal(normalized.recipient.name.length, 80);
  assert.doesNotMatch(normalized.recipient.name, /[<>\u0000]/);
  assert.equal(normalized.recipient.age, 120);
  assert.equal(normalized.sender.name, 'Minh Long');
  assert.equal(
    normalizeGiftConfig(raw, '?age=-9').recipient.age,
    1,
  );
  assert.equal(
    normalizeGiftConfig(raw, '?age=23years').recipient.age,
    23,
  );
});

test('normalizeGiftConfig keeps optional memory chapter and date metadata', () => {
  const raw = {
    recipient: { name: 'Thuy Hien', age: 23 },
    sender: { name: 'Yours Truly' },
    letter: { greeting: 'Dear', paragraphs: ['Happy birthday'], closing: 'With love' },
    epilogue: { heading: 'Happy Birthday', message: 'Always & forever' },
    giftReveal: giftRevealFixture,
    soundtrack: { src: '/audio.mp3', title: 'Perfect', loop: true, lyrics: [] },
    features: {
      cameraGestures: true,
      manualPhotoUpload: false,
      lyrics: true,
      postcard: true,
      voiceNote: false,
    },
    memories: [
      {
        id: 'memory-01',
        src: '/images/1.jpg',
        alt: 'Memory 1',
        caption: 'A favorite day',
        chapter: '  Our beginning  ',
        date: '  2024-02-14  ',
      },
      {
        id: 'memory-02',
        src: '/images/2.jpg',
        alt: 'Memory 2',
        caption: 'Another favorite day',
      },
    ],
  };

  const normalized = normalizeGiftConfig(raw);

  assert.equal(normalized.memories[0].chapter, 'Our beginning');
  assert.equal(normalized.memories[0].date, '2024-02-14');
  assert.equal('chapter' in normalized.memories[1], false);
  assert.equal('date' in normalized.memories[1], false);
});

test('validateGiftConfig reports an invalid root without throwing', () => {
  assert.deepEqual(
    validateGiftConfig(null),
    ['gift config must be an object.'],
  );
});

test('validateGiftConfig only accepts build-supported local media formats', () => {
  const gift = JSON.parse(readFileSync(
    new URL('../../src/content/gift.json', import.meta.url),
    'utf8',
  ));
  gift.soundtrack.src = '/audio.wav';
  gift.memories[0].src = '/uploads/first.png';

  assert.deepEqual(validateGiftConfig(gift), [
    'soundtrack.src must reference an MP3, M4A, or OGG file.',
    'memories[0].src must reference a JPG inside /images/.',
  ]);
});

test('validateGiftConfig requires a bounded local JPG gift reveal', () => {
  const gift = JSON.parse(readFileSync(
    new URL('../../src/content/gift.json', import.meta.url),
    'utf8',
  ));
  gift.giftReveal = {
    productName: '   ',
    articleNumber: '1'.repeat(101),
    src: '/uploads/dancing-swan.png',
    alt: '',
    caption: 'x'.repeat(501),
  };

  assert.deepEqual(validateGiftConfig(gift), [
    'giftReveal.productName must be a non-empty string.',
    'giftReveal.articleNumber must be at most 100 characters.',
    'giftReveal.src must reference a JPG inside /images/.',
    'giftReveal.alt must be a non-empty string.',
    'giftReveal.caption must be at most 500 characters.',
  ]);
});

test('validateGiftConfig returns readable, path-aware schema errors', () => {
  const errors = validateGiftConfig({
    recipient: { name: '   ', age: 0 },
    sender: { name: 42 },
    letter: {
      greeting: '',
      paragraphs: ['A valid paragraph', '   '],
      closing: null,
    },
    epilogue: {
      heading: '',
      message: null,
    },
    soundtrack: {
      src: 'https://example.com/audio.mp3',
      title: '',
      loop: 'yes',
      lyrics: [{ time: -1, text: '' }],
    },
    features: {
      cameraGestures: 'yes',
      manualPhotoUpload: false,
      lyrics: true,
      postcard: 'yes',
      voiceNote: false,
    },
    memories: [
      {
        id: 'memory-01',
        src: '/images/1.jpg',
        alt: '',
        caption: ' ',
      },
      {
        id: 'memory-01',
        src: '../images/2.jpg',
        alt: 'Memory 2',
        caption: 'A caption',
        chapter: 2,
        date: '',
      },
    ],
  });

  assert.deepEqual(errors, [
    'recipient.name must be a non-empty string.',
    'recipient.age must be an integer from 1 to 120.',
    'sender.name must be a non-empty string.',
    'letter.greeting must be a non-empty string.',
    'letter.paragraphs[1] must be a non-empty string.',
    'letter.closing must be a non-empty string.',
    'epilogue.heading must be a non-empty string.',
    'epilogue.message must be a non-empty string.',
    'giftReveal must be an object.',
    'soundtrack.src must be a safe root-relative public path.',
    'soundtrack.title must be a non-empty string.',
    'soundtrack.loop must be a boolean.',
    'soundtrack.lyrics[0].time must be a non-negative number.',
    'soundtrack.lyrics[0].text must be a non-empty string.',
    'features.cameraGestures must be a boolean.',
    'features.postcard must be a boolean.',
    'memories[0].alt must be a non-empty string.',
    'memories[0].caption must be a non-empty string.',
    'memories[1].id duplicates memories[0].id ("memory-01").',
    'memories[1].src must be a safe root-relative public path.',
    'memories[1].chapter must be a non-empty string when provided.',
    'memories[1].date must be a non-empty string when provided.',
  ]);
});

test('gift.json is the valid single source for all 21 existing memories', () => {
  const giftUrl = new URL('../../src/content/gift.json', import.meta.url);
  const gift = JSON.parse(readFileSync(giftUrl, 'utf8'));
  const expectedCaptions = [
    'Every moment with you is a treasure ✨',
    'The smile that lights up my world 😊',
    'This day, this memory, forever 💖',
    'Where we go, magic follows ✨',
    'My favorite person, always 🤍',
    "Time flies when we're together ♥️",
    'You make ordinary days extraordinary 🌟',
    'The laughter we share is priceless 🤣',
    'A piece of my heart, always with you 💜',
    'Captured happiness ✨',
    'Every photo tells our story 📸',
    'Your joy is contagious, I love it 🎉',
    'These memories keep me warm 🧣',
    'Beautiful soul, beautiful moments 🌸',
    'Forever grateful for you 🙏',
    'You are my sunshine ☀️',
    'Life is better with you in it 💚',
    'Every smile, a gift 🎁',
    'Together is my favorite place 🏠',
    'The best is yet to come 🚀',
    'Happy Birthday, always & forever 💖',
  ];

  assert.deepEqual(gift.giftReveal, {
    productName: 'Swarovski Dancing Swan',
    articleNumber: '5514421',
    src: '/images/swarovski-dancing-swan-5514421.jpg',
    alt: 'Dây chuyền Swarovski Dancing Swan màu trắng, mạ rhodium, đính crystal và zirconia',
    caption: 'Món quà đã mở: một ánh sáng nhỏ luôn chuyển động cùng em.',
  });
  assert.deepEqual(validateGiftConfig(gift), []);
  assert.equal(gift.recipient.name, 'Thuy Hien');
  assert.equal(gift.recipient.age, 23);
  assert.equal(gift.sender.name, 'Yours Truly');
  assert.equal(gift.soundtrack.src, '/audio.mp3');
  assert.equal(gift.soundtrack.loop, true);
  assert.deepEqual(gift.epilogue, {
    heading: 'Happy Birthday',
    message: 'Happy Birthday, always & forever 💖',
  });
  assert.deepEqual(gift.features, {
    cameraGestures: true,
    manualPhotoUpload: false,
    lyrics: true,
    postcard: true,
    voiceNote: false,
  });
  assert.deepEqual(
    gift.memories.map((memory) => memory.src),
    Array.from({ length: 21 }, (_, index) => `/images/${index + 1}.jpg`),
  );
  assert.deepEqual(
    gift.memories.map((memory) => memory.caption),
    expectedCaptions,
  );
});

test('validator CLI reports schema results and uses a nonzero error exit', () => {
  const validRun = runValidator();
  assert.equal(
    validRun.status,
    0,
    `${validRun.stdout}\n${validRun.stderr}`,
  );
  assert.match(validRun.stdout, /Gift validation passed/);

  const fixtureRoot = mkdtempSync(join(tmpdir(), 'gift-schema-'));
  try {
    const configPath = join(fixtureRoot, 'gift.json');
    const publicDir = join(fixtureRoot, 'public');
    mkdirSync(publicDir);
    writeFileSync(configPath, '{}\n');

    const invalidRun = runValidator(
      '--config',
      configPath,
      '--public-dir',
      publicDir,
      '--skip-runtime-assets',
      '--skip-variant-digests',
    );
    const output = `${invalidRun.stdout}\n${invalidRun.stderr}`;

    assert.equal(invalidRun.status, 1, output);
    assert.match(output, /Gift validation failed/);
    assert.match(output, /recipient must be an object\./);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('validator CLI exits nonzero when referenced media is missing', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'gift-media-'));
  try {
    const configPath = join(fixtureRoot, 'gift.json');
    const publicDir = join(fixtureRoot, 'public');
    const sourceGift = JSON.parse(readFileSync(
      new URL('../../src/content/gift.json', import.meta.url),
      'utf8',
    ));
    sourceGift.memories = [{
      id: 'memory-missing',
      src: '/images/missing.jpg',
      alt: 'A missing memory',
      caption: 'This file should be reported as missing.',
    }];
    sourceGift.giftReveal.src = sourceGift.memories[0].src;

    mkdirSync(publicDir);
    writeFileSync(join(publicDir, 'audio.mp3'), 'audio');
    writeFileSync(configPath, `${JSON.stringify(sourceGift, null, 2)}\n`);

    const run = runValidator(
      '--config',
      configPath,
      '--public-dir',
      publicDir,
      '--skip-runtime-assets',
      '--skip-variant-digests',
    );
    const output = `${run.stdout}\n${run.stderr}`;

    assert.equal(run.status, 1, output);
    assert.match(
      output,
      /memories\[0\]\.src references missing media: \/images\/missing\.jpg\./,
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('validator CLI requires the optimized WebP and AVIF memory variants', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'gift-variants-'));
  try {
    const configPath = join(fixtureRoot, 'gift.json');
    const publicDir = join(fixtureRoot, 'public');
    const imagesDir = join(publicDir, 'images');
    const sourceGift = JSON.parse(readFileSync(
      new URL('../../src/content/gift.json', import.meta.url),
      'utf8',
    ));
    sourceGift.memories = [{
      id: 'memory-source-only',
      src: '/images/source-only.jpg',
      alt: 'A memory without optimized variants',
      caption: 'The build should catch its missing responsive formats.',
    }];
    sourceGift.giftReveal.src = sourceGift.memories[0].src;

    mkdirSync(imagesDir, { recursive: true });
    writeFileSync(join(publicDir, 'audio.mp3'), 'audio');
    writeFileSync(join(imagesDir, 'source-only.jpg'), 'image');
    writeFileSync(configPath, `${JSON.stringify(sourceGift, null, 2)}\n`);

    const run = runValidator(
      '--config',
      configPath,
      '--public-dir',
      publicDir,
      '--skip-runtime-assets',
      '--skip-variant-digests',
    );
    const output = `${run.stdout}\n${run.stderr}`;

    assert.equal(run.status, 1, output);
    assert.match(output, /WebP variant.*\/images\/source-only\.webp/);
    assert.match(output, /AVIF variant.*\/images\/source-only\.avif/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('validator CLI requires optimized WebP and AVIF gift reveal variants', async () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'gift-reveal-variants-'));
  try {
    const configPath = join(fixtureRoot, 'gift.json');
    const publicDir = join(fixtureRoot, 'public');
    const imagesDir = join(publicDir, 'images');
    const sourceGift = JSON.parse(readFileSync(
      new URL('../../src/content/gift.json', import.meta.url),
      'utf8',
    ));
    sourceGift.giftReveal.src = '/images/reveal-source-only.jpg';
    sourceGift.memories = [{
      id: 'memory-complete',
      src: '/images/memory-complete.jpg',
      alt: 'A fully optimized memory',
      caption: 'Only the gift reveal should be missing responsive formats.',
    }];

    mkdirSync(imagesDir, { recursive: true });
    writeFileSync(join(publicDir, 'audio.mp3'), 'audio');
    const memoryImage = sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: '#c85d4b',
      },
    });
    await Promise.all([
      memoryImage.clone().jpeg().toFile(join(imagesDir, 'memory-complete.jpg')),
      memoryImage.clone().webp().toFile(join(imagesDir, 'memory-complete.webp')),
      memoryImage.clone().avif().toFile(join(imagesDir, 'memory-complete.avif')),
      memoryImage.clone().jpeg().toFile(join(imagesDir, 'reveal-source-only.jpg')),
    ]);
    writeFileSync(configPath, `${JSON.stringify(sourceGift, null, 2)}\n`);

    const run = runValidator(
      '--config',
      configPath,
      '--public-dir',
      publicDir,
      '--skip-runtime-assets',
      '--skip-variant-digests',
    );
    const output = `${run.stdout}\n${run.stderr}`;

    assert.equal(run.status, 1, output);
    assert.match(output, /giftReveal\.src WebP variant.*\/images\/reveal-source-only\.webp/);
    assert.match(output, /giftReveal\.src AVIF variant.*\/images\/reveal-source-only\.avif/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('validator CLI rejects stale optimized variants after a JPG is replaced', async () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'gift-digests-'));
  try {
    const configPath = join(fixtureRoot, 'gift.json');
    const publicDir = join(fixtureRoot, 'public');
    const imagesDir = join(publicDir, 'images');
    const sourceGift = JSON.parse(readFileSync(
      new URL('../../src/content/gift.json', import.meta.url),
      'utf8',
    ));
    sourceGift.memories = [{
      id: 'memory-digest',
      src: '/images/digest.jpg',
      alt: 'A digest-protected memory',
      caption: 'The optimized formats must belong to this exact JPG.',
    }];
    sourceGift.giftReveal.src = sourceGift.memories[0].src;

    mkdirSync(imagesDir, { recursive: true });
    writeFileSync(join(publicDir, 'audio.mp3'), 'audio');
    const sourcePath = join(imagesDir, 'digest.jpg');
    const webpPath = join(imagesDir, 'digest.webp');
    const avifPath = join(imagesDir, 'digest.avif');
    const image = sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: '#c85d4b',
      },
    });
    await Promise.all([
      image.clone().jpeg().toFile(sourcePath),
      image.clone().webp().toFile(webpPath),
      image.clone().avif().toFile(avifPath),
    ]);
    const digest = filePath => createHash('sha256')
      .update(readFileSync(filePath))
      .digest('hex');
    writeFileSync(
      join(imagesDir, '.variants.json'),
      `${JSON.stringify({
        version: 1,
        images: {
          'digest.jpg': {
            source: digest(sourcePath),
            webp: digest(webpPath),
            avif: digest(avifPath),
          },
        },
      }, null, 2)}\n`,
    );
    writeFileSync(configPath, `${JSON.stringify(sourceGift, null, 2)}\n`);

    const validRun = runValidator(
      '--config',
      configPath,
      '--public-dir',
      publicDir,
      '--skip-runtime-assets',
    );
    assert.equal(validRun.status, 0, `${validRun.stdout}\n${validRun.stderr}`);

    await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: '#7a998c',
      },
    }).jpeg().toFile(sourcePath);
    const staleRun = runValidator(
      '--config',
      configPath,
      '--public-dir',
      publicDir,
      '--skip-runtime-assets',
    );
    const output = `${staleRun.stdout}\n${staleRun.stderr}`;
    assert.equal(staleRun.status, 1, output);
    assert.match(output, /stale or modified source digest/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('validator CLI verifies gift reveal variant digests', async () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'gift-reveal-digests-'));
  try {
    const configPath = join(fixtureRoot, 'gift.json');
    const publicDir = join(fixtureRoot, 'public');
    const imagesDir = join(publicDir, 'images');
    const sourceGift = JSON.parse(readFileSync(
      new URL('../../src/content/gift.json', import.meta.url),
      'utf8',
    ));
    sourceGift.giftReveal.src = '/images/reveal-digest.jpg';
    sourceGift.memories = [{
      id: 'memory-digest',
      src: '/images/memory-digest.jpg',
      alt: 'A digest-protected memory',
      caption: 'Both configured image families must have current digests.',
    }];

    mkdirSync(imagesDir, { recursive: true });
    writeFileSync(join(publicDir, 'audio.mp3'), 'audio');
    const writeVariants = async (stem, color) => {
      const image = sharp({
        create: {
          width: 32,
          height: 32,
          channels: 3,
          background: color,
        },
      });
      await Promise.all([
        image.clone().jpeg().toFile(join(imagesDir, `${stem}.jpg`)),
        image.clone().webp().toFile(join(imagesDir, `${stem}.webp`)),
        image.clone().avif().toFile(join(imagesDir, `${stem}.avif`)),
      ]);
    };
    await Promise.all([
      writeVariants('memory-digest', '#c85d4b'),
      writeVariants('reveal-digest', '#152847'),
    ]);
    const digest = filePath => createHash('sha256')
      .update(readFileSync(filePath))
      .digest('hex');
    const digestEntry = stem => ({
      source: digest(join(imagesDir, `${stem}.jpg`)),
      webp: digest(join(imagesDir, `${stem}.webp`)),
      avif: digest(join(imagesDir, `${stem}.avif`)),
    });
    writeFileSync(
      join(imagesDir, '.variants.json'),
      `${JSON.stringify({
        version: 1,
        images: {
          'memory-digest.jpg': digestEntry('memory-digest'),
          'reveal-digest.jpg': digestEntry('reveal-digest'),
        },
      }, null, 2)}\n`,
    );
    writeFileSync(configPath, `${JSON.stringify(sourceGift, null, 2)}\n`);

    const validRun = runValidator(
      '--config',
      configPath,
      '--public-dir',
      publicDir,
      '--skip-runtime-assets',
    );
    assert.equal(validRun.status, 0, `${validRun.stdout}\n${validRun.stderr}`);

    await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: '#7a998c',
      },
    }).jpeg().toFile(join(imagesDir, 'reveal-digest.jpg'));
    const staleRun = runValidator(
      '--config',
      configPath,
      '--public-dir',
      publicDir,
      '--skip-runtime-assets',
    );
    const output = `${staleRun.stdout}\n${staleRun.stderr}`;

    assert.equal(staleRun.status, 1, output);
    assert.match(
      output,
      /\/images\/reveal-digest\.jpg has a stale or modified source digest/,
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('validator CLI warns about oversized media without failing validation', async () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'gift-size-'));
  try {
    const configPath = join(fixtureRoot, 'gift.json');
    const publicDir = join(fixtureRoot, 'public');
    const imagesDir = join(publicDir, 'images');
    const sourceGift = JSON.parse(readFileSync(
      new URL('../../src/content/gift.json', import.meta.url),
      'utf8',
    ));
    sourceGift.memories = [{
      id: 'memory-large',
      src: '/images/large.jpg',
      alt: 'A large memory',
      caption: 'Large enough to trigger a deployment warning.',
    }];
    sourceGift.giftReveal.src = sourceGift.memories[0].src;

    mkdirSync(imagesDir, { recursive: true });
    writeFileSync(join(publicDir, 'audio.mp3'), 'audio');
    const largeImagePath = join(imagesDir, 'large.jpg');
    const pixels = randomBytes(1200 * 1200 * 3);
    await Promise.all([
      sharp(pixels, {
        raw: { width: 1200, height: 1200, channels: 3 },
      })
        .jpeg({ quality: 100 })
        .toFile(largeImagePath),
      sharp({
        create: {
          width: 16,
          height: 16,
          channels: 3,
          background: '#c85d4b',
        },
      })
        .webp()
        .toFile(join(imagesDir, 'large.webp')),
      sharp({
        create: {
          width: 16,
          height: 16,
          channels: 3,
          background: '#c85d4b',
        },
      })
        .avif()
        .toFile(join(imagesDir, 'large.avif')),
    ]);
    writeFileSync(configPath, `${JSON.stringify(sourceGift, null, 2)}\n`);

    const run = runValidator(
      '--config',
      configPath,
      '--public-dir',
      publicDir,
      '--skip-runtime-assets',
      '--skip-variant-digests',
    );
    const output = `${run.stdout}\n${run.stderr}`;

    assert.equal(run.status, 0, output);
    assert.match(output, /Gift validation passed/);
    assert.match(output, /Warnings \(1\)/);
    assert.match(
      output,
      /memories\[0\]\.src \(\/images\/large\.jpg\) is .* above the recommended 1 MiB limit\./,
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
