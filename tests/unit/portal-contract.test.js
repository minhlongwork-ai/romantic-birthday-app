import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { applyExperienceCatalog } from '../../portal/experience-catalog-plugin.mjs';
import { loadExperienceRegistry } from '../../scripts/experience-registry.mjs';

const [portalSourceHtml, portalScript, notFoundHtml] = await Promise.all([
  readFile(new URL('../../portal/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../../portal/portal.js', import.meta.url), 'utf8'),
  readFile(new URL('../../portal/404.html', import.meta.url), 'utf8'),
]);

test('chooser renders September as a chronological, openable monthly card with the shared personalization contract', async () => {
  const portalHtml = applyExperienceCatalog(portalSourceHtml, await loadExperienceRegistry());
  const projectLinks = [...portalHtml.matchAll(/href="(\/(?:birthday|august|september)\/)"\s+data-project-link/g)]
    .map(match => match[1]);
  const september = portalHtml.slice(portalHtml.indexOf('gift-card-september'));

  assert.deepEqual(projectLinks, ['/birthday/', '/august/', '/september/']);
  assert.ok(portalHtml.indexOf('gift-card-birthday') < portalHtml.indexOf('gift-card-august'));
  assert.ok(portalHtml.indexOf('gift-card-august') < portalHtml.indexOf('gift-card-september'));
  assert.match(portalHtml, /src="\/experience-previews\/september\.webp"/);
  assert.match(portalHtml, /aria-describedby="september-description"/);
  assert.match(portalHtml, /Bánh kem chanh và bó hồng kem hồng phấn trên nền lụa nâu ấm/);
  assert.match(portalHtml, /Thư tháng Chín/);
  assert.match(portalHtml, />Một chút ngọt, một chút hoa</);
  assert.match(
    portalHtml,
    /Một lá thư nhỏ, bánh tiramisu chanh và một bó hoa dành cho em\./,
  );
  assert.match(september, /href="\/september\/"[\s\S]*?data-project-link/);
  assert.match(september, /Xem thiệp tháng Chín/);
  assert.doesNotMatch(september, /aria-disabled="true"|Xem bản tương tác/);
  assert.doesNotMatch(portalHtml, /Ba Pha Trăng|bộ ba mỹ phẩm|ba vầng trăng/u);
  assert.match(portalScript, /const forwardedKeys = \["to", "from", "age"\];/);
});

test('shared 404 returns to the chooser without describing every route as an album', () => {
  assert.match(notFoundHtml, /href="\/"/);
  assert.match(notFoundHtml, /Trang này không có trong cuốn thiệp\./);
  assert.doesNotMatch(notFoundHtml, /cuốn album/);
});
