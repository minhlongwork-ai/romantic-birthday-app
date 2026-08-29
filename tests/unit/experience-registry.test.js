import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  groupExperiencesByYear,
  loadExperienceRegistry,
  selectBuildExperiences,
  validateExperienceRegistry,
} from '../../scripts/experience-registry.mjs';

test('catalog records load in registry-derived chronological order', async () => {
  const sourceRecords = JSON.parse(
    await readFile(new URL('../../src/content/experiences.json', import.meta.url), 'utf8'),
  );
  const expected = [...sourceRecords].sort((left, right) =>
    left.year - right.year || left.month - right.month || left.id.localeCompare(right.id));
  const records = await loadExperienceRegistry();

  assert.deepEqual(
    records.map(({ id, year, month }) => ({ id, year, month })),
    expected.map(({ id, year, month }) => ({ id, year, month })),
  );
  assert.deepEqual(
    groupExperiencesByYear(records).map(({ year }) => year),
    [...new Set(expected.map(({ year }) => year))],
  );
});

test('production selects only published records', async () => {
  const records = await loadExperienceRegistry();
  assert.deepEqual(
    selectBuildExperiences(records, 'production').map(({ id }) => id),
    records.filter(({ status }) => status === 'published').map(({ id }) => id),
  );
  assert.deepEqual(
    selectBuildExperiences(records, 'preview').map(({ id }) => id),
    records.map(({ id }) => id),
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

test('rejects a regular file that is not a decodable preview image', async () => {
  await assertInvalid(records => {
    records.find(record => record.id === 'september').preview.source = 'package.json';
  }, 'september', 'preview.source');
});

test('rejects preview dimensions that do not match the source image', async () => {
  await assertInvalid(records => {
    records.find(record => record.id === 'september').preview.width += 1;
  }, 'september', 'preview.width');
});

test('rejects oversized recipient-facing registry copy', async () => {
  for (const field of ['kind', 'title', 'description', 'actionLabel']) {
    await assertInvalid(records => {
      records.find(record => record.id === 'september')[field] = 'x'.repeat(201);
    }, 'september', field);
  }
  await assertInvalid(records => {
    records.find(record => record.id === 'september').preview.alt = 'x'.repeat(201);
  }, 'september', 'preview.alt');
});

test('rejects a missing release validator', async () => {
  await assertInvalid(records => {
    records.find(record => record.id === 'september').build.validation.release[0] = 'apps/september/scripts/missing.mjs';
  }, 'september', 'build.validation.release');
});

test('rejects directories in file-valued registry fields', async () => {
  await assertInvalid(records => {
    records.find(record => record.id === 'september').preview.source = 'apps/september/public/images';
  }, 'september', 'preview.source');
  await assertInvalid(records => {
    records.find(record => record.id === 'september').build.config = 'apps/september';
  }, 'september', 'build.config');
  await assertInvalid(records => {
    records.find(record => record.id === 'september').build.validation.release[0] = 'apps/september/scripts';
  }, 'september', 'build.validation.release');
  await assertInvalid(records => {
    records.find(record => record.id === 'birthday').build.postBuild[0].script = 'scripts';
  }, 'birthday', 'build.postBuild.0');
});
