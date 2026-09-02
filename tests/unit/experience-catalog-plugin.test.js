import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadExperienceRegistry } from '../../scripts/experience-registry.mjs';
import {
  applyExperienceCatalog,
  createExperienceCatalogPlugin,
} from '../../portal/experience-catalog-plugin.mjs';

test('catalog transform emits rendered published cards and removes the marker', async () => {
  const template = await readFile(new URL('../../portal/index.html', import.meta.url), 'utf8');
  const records = await loadExperienceRegistry();
  const output = applyExperienceCatalog(template, records);

  assert.doesNotMatch(output, /EXPERIENCE_CATALOG/);
  assert.match(output, /href="\/birthday\/"[\s\S]*?data-project-link/);
  assert.match(output, /href="\/august\/"[\s\S]*?data-project-link/);
  assert.doesNotMatch(output, /href="\/september\/"[\s\S]*?data-project-link/);
  assert.match(output, /class="gift-card gift-card-birthday"/);
});

test('catalog transform can expose draft interaction only when explicitly enabled', async () => {
  const template = await readFile(new URL('../../portal/index.html', import.meta.url), 'utf8');
  const records = await loadExperienceRegistry();
  const output = applyExperienceCatalog(template, records, { allowDraftInteraction: true });

  assert.match(output, /href="\/september\/"[\s\S]*?data-project-link/);
  assert.match(output, /Xem bản tương tác/);
});

test('catalog transform rejects templates without exactly one marker', () => {
  const records = [];

  assert.throws(
    () => applyExperienceCatalog('<main></main>', records),
    /portal\/index\.html must contain exactly one EXPERIENCE_CATALOG marker\./,
  );
  assert.throws(
    () => applyExperienceCatalog('<!-- EXPERIENCE_CATALOG --><!-- EXPERIENCE_CATALOG -->', records),
    /portal\/index\.html must contain exactly one EXPERIENCE_CATALOG marker\./,
  );
});

test('catalog plugin runs before later HTML transforms', () => {
  const plugin = createExperienceCatalogPlugin([]);

  assert.equal(plugin.name, 'experience-catalog');
  assert.equal(plugin.transformIndexHtml.order, 'pre');
  assert.equal(
    plugin.transformIndexHtml.handler('<!-- EXPERIENCE_CATALOG -->'),
    '',
  );
});
