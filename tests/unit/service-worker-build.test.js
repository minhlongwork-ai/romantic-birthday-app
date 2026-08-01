import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const serviceWorkerTemplate = `
const version = '__BUILD_CACHE_VERSION__';
const assets = /*__BUILD_ASSETS__*/ [];
`;

function finalize(distDir) {
  const result = spawnSync(
    process.execPath,
    ['scripts/finalize-service-worker.mjs', distDir],
    { cwd: projectRoot, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const source = readFileSync(join(distDir, 'service-worker.js'), 'utf8');
  return source.match(/birthday-keepsake-([a-f0-9]+)/)?.[1];
}

test('Vercel revalidates the root migration worker on every request', () => {
  const config = JSON.parse(
    readFileSync(join(projectRoot, 'vercel.json'), 'utf8'),
  );
  const serviceWorkerHeaders = config.headers?.find(
    entry => entry.source === '/service-worker.js',
  )?.headers;

  assert.ok(serviceWorkerHeaders, 'Missing /service-worker.js response headers.');
  assert.deepEqual(
    serviceWorkerHeaders.find(header => header.key === 'Cache-Control'),
    {
      key: 'Cache-Control',
      value: 'public, max-age=0, must-revalidate',
    },
  );
});

test('root migration still reloads a legacy page when cache cleanup fails', async () => {
  const source = readFileSync(
    join(projectRoot, 'portal/service-worker.js'),
    'utf8',
  );
  const legacyPageURL = 'https://gift.example/?to=Em';
  let activateHandler;
  let navigatedTo = null;
  let registrationRetired = false;

  const workerGlobal = {
    addEventListener(type, handler) {
      if (type === 'activate') activateHandler = handler;
    },
    clients: {
      async claim() {},
      async matchAll() {
        return [
          {
            url: legacyPageURL,
            async navigate(url) {
              navigatedTo = url;
            },
          },
        ];
      },
    },
    registration: {
      scope: 'https://gift.example/',
      async unregister() {
        registrationRetired = true;
        return true;
      },
    },
    async skipWaiting() {},
  };

  runInNewContext(source, {
    URL,
    caches: {
      async keys() {
        throw new Error('CacheStorage is unavailable');
      },
    },
    self: workerGlobal,
  });

  assert.equal(typeof activateHandler, 'function');
  let activation;
  activateHandler({
    waitUntil(promise) {
      activation = promise;
    },
  });
  await activation;

  assert.equal(registrationRetired, true);
  assert.equal(navigatedTo, legacyPageURL);
});

test('service-worker cache revision changes when a public media file changes', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'birthday-sw-'));
  const distDir = join(fixtureRoot, 'dist');
  try {
    mkdirSync(join(distDir, '.vite'), { recursive: true });
    mkdirSync(join(distDir, 'assets'), { recursive: true });
    mkdirSync(join(distDir, 'images'), { recursive: true });
    writeFileSync(
      join(distDir, '.vite/manifest.json'),
      JSON.stringify({
        'index.html': {
          file: 'assets/main.js',
          isEntry: true,
        },
      }),
    );
    writeFileSync(join(distDir, 'index.html'), '<main>Birthday</main>');
    writeFileSync(join(distDir, 'assets/main.js'), 'console.log("gift")');
    writeFileSync(join(distDir, 'images/memory.webp'), 'first memory');
    writeFileSync(join(distDir, 'service-worker.js'), serviceWorkerTemplate);

    const firstRevision = finalize(distDir);

    writeFileSync(join(distDir, 'images/memory.webp'), 'updated memory');
    writeFileSync(join(distDir, 'service-worker.js'), serviceWorkerTemplate);
    const secondRevision = finalize(distDir);

    assert.ok(firstRevision);
    assert.ok(secondRevision);
    assert.notEqual(firstRevision, secondRevision);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
