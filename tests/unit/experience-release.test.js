import assert from 'node:assert/strict';
import test from 'node:test';

import { loadExperienceRegistry } from '../../scripts/experience-registry.mjs';
import { createReleaseValidationPlan } from '../../scripts/experience-release.mjs';

test('draft September cannot block a production deployment', async () => {
  const records = await loadExperienceRegistry();
  const plan = createReleaseValidationPlan(records, 'production');
  const published = records.filter(({ status }) => status === 'published');

  assert.deepEqual(plan.map(({ id }) => id), published.map(({ id }) => id));
  assert.deepEqual(
    plan.map(({ argv }) => argv),
    published.map(record => record.build.validation.release),
  );
});

test('publishing an unapproved September invokes its release gate', async () => {
  const records = structuredClone(await loadExperienceRegistry());
  records.find(record => record.id === 'september').status = 'published';
  const plan = createReleaseValidationPlan(records, 'production');

  assert.deepEqual(plan.find(({ id }) => id === 'september').argv, [
    'apps/september/scripts/validate.mjs',
    '--release',
  ]);
});

test('preview and development validation remain fixture-tolerant', async () => {
  const records = await loadExperienceRegistry();

  for (const environment of ['preview', 'development']) {
    const plan = createReleaseValidationPlan(records, environment);
    assert.deepEqual(plan.map(({ id }) => id), records.map(({ id }) => id));
    assert.deepEqual(plan.map(({ argv }) => argv),
      records.map(record => record.build.validation.development));
  }
});
