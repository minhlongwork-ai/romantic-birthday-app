import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

const catalog = JSON.parse(
  await readFile(new URL('../../src/content/experiences.json', import.meta.url), 'utf8'),
);
const orderedExperiences = [...catalog].sort((left, right) =>
  left.year - right.year || left.month - right.month);
const vietnameseMonths = [
  'Tháng Một',
  'Tháng Hai',
  'Tháng Ba',
  'Tháng Tư',
  'Tháng Năm',
  'Tháng Sáu',
  'Tháng Bảy',
  'Tháng Tám',
  'Tháng Chín',
  'Tháng Mười',
  'Tháng Mười Một',
  'Tháng Mười Hai',
];

test('the chooser omits the kicker and loads its Vietnamese display font', async ({
  baseURL,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'Portal typography is verified once in desktop Chrome.',
  );

  const chooserURL = new URL('../', baseURL);
  await page.goto(chooserURL.href);

  await expect(page.locator('.portal-kicker')).toHaveCount(0);
  const heading = page.getByRole('heading', {
    level: 1,
    name: 'Hôm nay em muốn mở điều gì?',
  });
  await expect(heading).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  const typography = await heading.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      fontFamily: style.fontFamily,
      fontLoaded: document.fonts.check(
        `${style.fontWeight} ${style.fontSize} "Cormorant Garamond"`,
        element.textContent,
      ),
      lineHeight: Number.parseFloat(style.lineHeight),
      fontSize: Number.parseFloat(style.fontSize),
    };
  });

  expect(typography.fontFamily).toContain('Cormorant Garamond');
  expect(typography.fontLoaded).toBe(true);
  expect(typography.lineHeight).toBeGreaterThanOrEqual(
    typography.fontSize * 0.98,
  );
});

test('the chooser renders the registry timeline and forwards only supported personalization', async ({
  baseURL,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'Chooser routing is verified once in desktop Chrome.',
  );

  const chooserURL = new URL('../', baseURL);
  chooserURL.search = new URLSearchParams({
    to: 'Em Test',
    from: 'Shyn',
    age: '24',
    privateNote: 'must-not-leak',
  });
  chooserURL.hash = 'private-fragment';
  await page.goto(chooserURL.href);

  const publishedExperiences = orderedExperiences.filter(({ status }) => status === 'published');
  const draftExperiences = orderedExperiences.filter(({ status }) => status === 'draft');
  await expect(page.locator('.gift-card')).toHaveCount(orderedExperiences.length);
  await expect(page.locator('.experience-year-title')).toHaveText(
    [...new Set(orderedExperiences.map(({ year }) => String(year)))],
  );
  await expect(page.locator('.gift-month')).toHaveText(
    orderedExperiences.map(({ month }) => vietnameseMonths[month - 1]),
  );

  const expectedQuery = '?to=Em+Test&from=Shyn&age=24';
  for (const experience of publishedExperiences) {
    const card = page.locator(`.gift-card-${experience.id}`);
    await expect(card).toHaveAttribute('href', `${experience.route}${expectedQuery}`);
    await expect(card).toHaveAttribute('data-project-link', '');
    const destination = await card.getAttribute('href');
    const response = await page.request.get(new URL(destination, chooserURL).href);
    expect(response.status()).toBe(200);
    expect(response.url()).not.toContain('privateNote');
    expect(response.url()).not.toContain('private-fragment');
  }

  for (const experience of draftExperiences) {
    const card = page.locator(`.gift-card-${experience.id}`);
    expect(await card.evaluate(element => element.tagName)).toBe('ARTICLE');
    await expect(card).toHaveAttribute('aria-disabled', 'true');
    await expect(card).not.toHaveAttribute('href');
    await expect(card).not.toHaveAttribute('data-project-link');
    await expect(card.locator('.sr-only')).toHaveText('Thiệp này hiện chưa thể mở.');
  }
  await expect(page.locator('body')).not.toContainText(
    /draft|published|đang hoàn thiện|trạng thái/i,
  );

  const publishedExperience = publishedExperiences[0];
  if (!publishedExperience) throw new Error('Registry must contain a published experience.');
  const publishedCard = page.locator(`.gift-card-${publishedExperience.id}`);
  await publishedCard.locator('.gift-media img').evaluate(image => {
    image.setAttribute('src', '/__e2e__/missing-preview.webp');
  });
  await expect(publishedCard.locator('.gift-media')).toHaveClass(/is-unavailable/);
  await expect(publishedCard.locator('.gift-title')).toHaveText(publishedExperience.title);
  await expect(publishedCard).toHaveAttribute(
    'href',
    `${publishedExperience.route}${expectedQuery}`,
  );
});
