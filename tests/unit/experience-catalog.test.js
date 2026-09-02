import assert from 'node:assert/strict';
import test from 'node:test';

import { loadExperienceRegistry } from '../../scripts/experience-registry.mjs';
import {
  formatVietnameseMonth,
  renderExperienceCatalog,
} from '../../portal/experience-catalog.mjs';

test('catalog groups by year and keeps chronological month order', async () => {
  const records = await loadExperienceRegistry();
  const html = renderExperienceCatalog(records);

  assert.ok(html.indexOf('Tháng Năm') < html.indexOf('Tháng Tám'));
  assert.ok(html.indexOf('Tháng Tám') < html.indexOf('Tháng Chín'));
  assert.equal((html.match(/<h2[^>]*>2026<\/h2>/g) || []).length, 1);
});

test('draft content has no visible status or interaction', async () => {
  const html = renderExperienceCatalog(await loadExperienceRegistry());
  const september = html.slice(html.indexOf('gift-card-september'));

  assert.doesNotMatch(september, /href="\/september\/"|data-project-link/);
  assert.doesNotMatch(september, /draft|published|Đang hoàn thiện|trạng thái/ui);
  assert.match(september, /aria-disabled="true"/);
  assert.match(september, /class="sr-only"/);
  assert.doesNotMatch(september, /gift-action/);
});

test('preview mode exposes a draft card as an interactive preview', async () => {
  const html = renderExperienceCatalog(await loadExperienceRegistry(), {
    allowDraftInteraction: true,
  });
  const september = html.slice(html.indexOf('gift-card-september'));

  assert.match(september, /href="\/september\/"[\s\S]*?data-project-link/);
  assert.match(september, /Xem bản tương tác/);
  assert.doesNotMatch(september, /aria-disabled="true"/);
});

test('the first published card keeps the above-fold image loading priority', async () => {
  const html = renderExperienceCatalog(await loadExperienceRegistry());
  const birthday = html.slice(html.indexOf('gift-card-birthday'), html.indexOf('gift-card-august'));

  assert.match(birthday, /src="\/experience-previews\/birthday\.webp"[\s\S]*fetchpriority="high"/);
  assert.doesNotMatch(birthday, /loading="lazy"/);
});

test('image priority follows rendered chronology for unsorted records', async () => {
  const records = await loadExperienceRegistry();
  const byId = Object.fromEntries(records.map(record => [record.id, record]));
  const html = renderExperienceCatalog([byId.august, byId.september, byId.birthday]);
  const birthday = html.slice(html.indexOf('gift-card-birthday'), html.indexOf('gift-card-august'));
  const august = html.slice(html.indexOf('gift-card-august'), html.indexOf('gift-card-september'));

  assert.match(birthday, /fetchpriority="high"/);
  assert.doesNotMatch(birthday, /loading="lazy"/);
  assert.match(august, /loading="lazy"/);
  assert.doesNotMatch(august, /fetchpriority="high"/);
});

test('catalog escapes record text and attributes', () => {
  const html = renderExperienceCatalog([{
    id: 'memory',
    year: 2027,
    month: 1,
    kind: '<Kind & memory>',
    title: '"Title"',
    description: "It's <private>",
    route: '/memory/?q="x"',
    status: 'published',
    actionLabel: 'Open & remember',
    preview: {
      publicPath: '/experience-previews/memory.webp?x="y"',
      alt: '<photo & "memory">',
      width: 1200,
      height: 630,
    },
  }]);

  assert.match(html, /&lt;Kind &amp; memory&gt;/);
  assert.match(html, /&quot;Title&quot;/);
  assert.match(html, /It&#39;s &lt;private&gt;/);
  assert.match(html, /href="\/memory\/\?q=&quot;x&quot;"/);
  assert.match(html, /alt="&lt;photo &amp; &quot;memory&quot;&gt;"/);
});

test('Vietnamese month formatter uses familiar month names', () => {
  assert.equal(formatVietnameseMonth(5), 'Tháng Năm');
  assert.equal(formatVietnameseMonth(8), 'Tháng Tám');
  assert.equal(formatVietnameseMonth(9), 'Tháng Chín');
});
