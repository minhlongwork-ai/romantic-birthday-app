import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createExperiencePreviewCopies,
  createExperienceRouteBuilds,
  findExperienceForUrl,
  resolveBuildEnvironment,
} from '../../scripts/experience-builds.mjs';
import { loadExperienceRegistry } from '../../scripts/experience-registry.mjs';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const paths = {
  projectRoot,
  stagingDir: resolve(projectRoot, 'staging'),
  distDir: resolve(projectRoot, 'dist'),
};

test('preview builds every experience while production builds only published experiences', async () => {
  const records = await loadExperienceRegistry();

  assert.deepEqual(
    createExperienceRouteBuilds({ records, environment: 'preview', paths })
      .map(({ id }) => id),
    records.map(({ id }) => id),
  );
  assert.deepEqual(
    createExperienceRouteBuilds({ records, environment: 'production', paths })
      .map(({ id }) => id),
    records.filter(({ status }) => status === 'published').map(({ id }) => id),
  );
});

test('route plans resolve build paths and expand each hook against its own staging output', async () => {
  const records = await loadExperienceRegistry();
  const routes = createExperienceRouteBuilds({ records, environment: 'development', paths });
  const birthday = routes.find(({ id }) => id === 'birthday');
  const august = routes.find(({ id }) => id === 'august');

  assert.deepEqual(
    {
      path: birthday.path,
      config: birthday.config,
      output: birthday.output,
      destination: birthday.destination,
      index: birthday.index,
      validationArgv: birthday.validationArgv,
      postBuild: birthday.postBuild,
    },
    {
      path: '/birthday/',
      config: resolve(projectRoot, 'vite.config.js'),
      output: resolve(paths.stagingDir, 'birthday'),
      destination: resolve(paths.distDir, 'birthday'),
      index: '/birthday/index.html',
      validationArgv: ['scripts/validate-gift.mjs'],
      postBuild: [{
        script: resolve(projectRoot, 'scripts/finalize-service-worker.mjs'),
        args: [resolve(paths.stagingDir, 'birthday')],
      }],
    },
  );
  assert.deepEqual(august.copies, [{
    mode: 'tree',
    source: resolve(projectRoot, 'apps/august/public'),
    destination: resolve(paths.distDir, 'august/public'),
  }]);
});

test('preview copy plans include drafts and reject colliding public destinations', async () => {
  const records = await loadExperienceRegistry();
  assert.deepEqual(
    createExperiencePreviewCopies({ records, paths }).map(({ id, publicPath, destination }) => ({
      id,
      publicPath,
      destination,
    })),
    records.map(record => ({
      id: record.id,
      publicPath: record.preview.publicPath,
      destination: resolve(paths.distDir, record.preview.publicPath.replace(/^\/+/, '')),
    })),
  );

  const colliding = structuredClone(records);
  colliding[1].preview.publicPath = colliding[0].preview.publicPath;
  assert.throws(
    () => createExperiencePreviewCopies({ records: colliding, paths }),
    /Preview copy destination collision.*birthday.*august/iu,
  );
});

test('URL ownership uses the longest matching experience route prefix', () => {
  const experiences = [
    { id: 'album', route: '/birthday/' },
    { id: 'chapter', route: '/birthday/chapter/' },
    { id: 'august', route: '/august/' },
  ];

  assert.equal(findExperienceForUrl('/birthday/chapter/assets/card.webp', experiences)?.id, 'chapter');
  assert.equal(findExperienceForUrl('https://example.test/birthday/images/1.webp?size=2', experiences)?.id, 'album');
  assert.equal(findExperienceForUrl('/birthday-party/index.html', experiences), null);
  assert.equal(findExperienceForUrl('/experience-previews/birthday.webp', experiences), null);
});

test('build environment maps Vercel and explicit composite environments', () => {
  assert.equal(resolveBuildEnvironment({}), 'development');
  assert.equal(resolveBuildEnvironment({ VERCEL_ENV: 'preview' }), 'preview');
  assert.equal(resolveBuildEnvironment({ VERCEL_ENV: 'production' }), 'production');
  assert.equal(resolveBuildEnvironment({ EXPERIENCE_BUILD_ENV: 'preview' }), 'preview');
  assert.equal(resolveBuildEnvironment({ EXPERIENCE_BUILD_ENV: 'production' }), 'production');
  assert.equal(
    resolveBuildEnvironment({ VERCEL_ENV: 'preview', EXPERIENCE_BUILD_ENV: 'production' }),
    'production',
  );
});
