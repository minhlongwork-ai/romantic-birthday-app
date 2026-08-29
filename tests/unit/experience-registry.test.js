import assert from 'node:assert/strict';
import test from 'node:test';

import {
  groupExperiencesByYear,
  loadExperienceRegistry,
  selectBuildExperiences,
  validateExperienceRegistry,
} from '../../scripts/experience-registry.mjs';

test('2026 catalog is ordered May, August, September', async () => {
  const records = await loadExperienceRegistry();
  assert.deepEqual(records.map(({ id }) => id), ['birthday', 'august', 'september']);
  assert.deepEqual(records.map(({ month }) => month), [5, 8, 9]);
  assert.deepEqual(groupExperiencesByYear(records).map(({ year }) => year), [2026]);
});

test('production selects only published records', async () => {
  const records = await loadExperienceRegistry();
  assert.deepEqual(
    selectBuildExperiences(records, 'production').map(({ id }) => id),
    ['birthday', 'august'],
  );
  assert.deepEqual(
    selectBuildExperiences(records, 'preview').map(({ id }) => id),
    ['birthday', 'august', 'september'],
  );
});

async function recordsWith(mutator) {
  const records = structuredClone(await loadExperienceRegistry());
  mutator(records);
  return records;
}

async function assertInvalid(mutator, id, field) {
  const errors = await validateExperienceRegistry(await recordsWith(mutator));
  assert.match(errors.join('\n'), new RegExp(`${id}.*${field}`, 's'));
}

test('rejects a duplicate experience month', async () => {
  await assertInvalid(records => {
    records.find(record => record.id === 'september').month = 8;
  }, 'september', 'month');
});

test('rejects an external route', async () => {
  await assertInvalid(records => {
    records.find(record => record.id === 'september').route = 'https://example.test/september/';
  }, 'september', 'route');
});

test('rejects a config path outside the repository', async () => {
  await assertInvalid(records => {
    records.find(record => record.id === 'september').build.config = '../vite.config.js';
  }, 'september', 'build.config');
});

test('rejects a duplicate preview output', async () => {
  await assertInvalid(records => {
    records.find(record => record.id === 'september').preview.publicPath = '/experience-previews/august.webp';
  }, 'september', 'preview.publicPath');
});

test('rejects an unsupported status', async () => {
  await assertInvalid(records => {
    records.find(record => record.id === 'september').status = 'scheduled';
  }, 'september', 'status');
});

test('rejects a missing preview image', async () => {
  await assertInvalid(records => {
    records.find(record => record.id === 'september').preview.source = 'apps/september/public/images/missing.webp';
  }, 'september', 'preview.source');
});

test('rejects a missing release validator', async () => {
  await assertInvalid(records => {
    records.find(record => record.id === 'september').build.validation.release[0] = 'apps/september/scripts/missing.mjs';
  }, 'september', 'build.validation.release');
});
