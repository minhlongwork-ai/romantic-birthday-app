import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [portalHtml, portalScript, notFoundHtml] = await Promise.all([
  readFile(new URL('../../portal/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../../portal/portal.js', import.meta.url), 'utf8'),
  readFile(new URL('../../portal/404.html', import.meta.url), 'utf8'),
]);

test('chooser offers all three canonical experiences with the shared personalization contract', () => {
  const projectLinks = [...portalHtml.matchAll(/href="(\/(?:birthday|august|september)\/)"\s+data-project-link/g)]
    .map(match => match[1]);
  assert.deepEqual(projectLinks, ['/birthday/', '/august/', '/september/']);
  assert.match(portalHtml, /src="\/september\/images\/preview\.webp"/);
  assert.match(portalHtml, /aria-describedby="september-description"/);
  assert.match(portalHtml, /Bánh kem chanh và bó hồng kem hồng phấn trên nền lụa nâu ấm/);
  assert.match(portalHtml, /Hộp quà hai món/);
  assert.match(portalHtml, />Một chút ngọt, một chút hoa</);
  assert.match(
    portalHtml,
    /Chạm vào bánh và hoa theo thứ tự em chọn, rồi thắt chiếc nơ cuối cùng\./,
  );
  assert.match(portalHtml, /Mở hộp quà tháng Chín/);
  assert.doesNotMatch(portalHtml, /Ba Pha Trăng|bộ ba mỹ phẩm|ba vầng trăng/u);
  assert.match(portalScript, /const forwardedKeys = \["to", "from", "age"\];/);
});

test('shared 404 returns to the chooser without describing every route as an album', () => {
  assert.match(notFoundHtml, /href="\/"/);
  assert.match(notFoundHtml, /Trang này không có trong cuốn thiệp\./);
  assert.doesNotMatch(notFoundHtml, /cuốn album/);
});
