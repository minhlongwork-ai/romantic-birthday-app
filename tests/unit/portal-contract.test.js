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

test('chooser renders published links and a non-interactive September card with the shared personalization contract', async () => {
  const portalHtml = applyExperienceCatalog(portalSourceHtml, await loadExperienceRegistry());
  const projectLinks = [...portalHtml.matchAll(/href="(\/(?:birthday|august|september)\/)"\s+data-project-link/g)]
    .map(match => match[1]);
  const september = portalHtml.slice(portalHtml.indexOf('gift-card-september'));

  assert.deepEqual(projectLinks, ['/birthday/', '/august/']);
  assert.ok(portalHtml.indexOf('gift-card-birthday') < portalHtml.indexOf('gift-card-august'));
  assert.ok(portalHtml.indexOf('gift-card-august') < portalHtml.indexOf('gift-card-september'));
  assert.match(portalHtml, /src="\/experience-previews\/september\.webp"/);
  assert.match(portalHtml, /aria-describedby="september-description"/);
  assert.match(portalHtml, /Một phong bì giấy đóng kín trên bàn gỗ trong một xưởng nhỏ ánh đèn ấm/);
  assert.match(portalHtml, /Hộp quà hai món/);
  assert.match(portalHtml, />Một chút ngọt, một chút hoa</);
  assert.match(
    portalHtml,
    /Một hộp quà nhỏ với hai bất ngờ — em chọn món mình muốn mở trước\./,
  );
  assert.match(portalHtml, /<article class="gift-card gift-card-september" aria-disabled="true"/);
  assert.doesNotMatch(september, /href="\/september\/"|data-project-link|Mở hộp quà tháng Chín/);
  assert.doesNotMatch(portalHtml, /Ba Pha Trăng|bộ ba mỹ phẩm|ba vầng trăng/u);
  assert.match(portalScript, /const forwardedKeys = \["to", "from", "age"\];/);
});

test('shared 404 returns to the chooser without describing every route as an album', () => {
  assert.match(notFoundHtml, /href="\/"/);
  assert.match(notFoundHtml, /Trang này không có trong cuốn thiệp\./);
  assert.doesNotMatch(notFoundHtml, /cuốn album/);
});
