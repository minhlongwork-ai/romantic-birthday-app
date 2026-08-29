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

test('the chooser renders the registry as a chronological, human-facing timeline', async ({
  baseURL,
  page,
}) => {
  await page.goto(new URL('../', baseURL).href);

  await expect(page.locator('.gift-card')).toHaveCount(orderedExperiences.length);
  const expectedYears = [...new Set(orderedExperiences.map(({ year }) => String(year)))];
  await expect(page.locator('.experience-year-title')).toHaveText(expectedYears);
  await expect(page.locator('.gift-month')).toHaveText(
    orderedExperiences.map(({ month }) => vietnameseMonths[month - 1]),
  );

  for (const experience of orderedExperiences) {
    const card = page.locator(`.gift-card-${experience.id}`);
    await expect(card).toBeVisible();

    if (experience.status === 'published') {
      await expect(card).toHaveAttribute('href', experience.route);
      await expect(card).toHaveAttribute('data-project-link', '');
      continue;
    }

    await expect(card).toHaveAttribute('aria-disabled', 'true');
    await expect(card).not.toHaveAttribute('href', /.+/);
    await expect(card).not.toHaveAttribute('data-project-link');
    await expect(card.locator('.sr-only')).toHaveText('Thiệp này hiện chưa thể mở.');
    await expect(card.locator('a, button, input, select, textarea, [tabindex]')).toHaveCount(0);
  }

  await expect(page.locator('body')).not.toContainText(
    /draft|published|đang hoàn thiện|trạng thái/i,
  );
});

test('the chooser forwards only approved personalization to published cards', async ({
  baseURL,
  page,
}) => {
  const chooserURL = new URL('../', baseURL);
  chooserURL.search = new URLSearchParams([
    ['to', 'Em Test'],
    ['from', 'Shyn'],
    ['age', '24'],
    ['privateNote', 'must-not-leak'],
  ]).toString();
  chooserURL.hash = 'private-fragment';
  await page.goto(chooserURL.href);

  const expectedQuery = '?to=Em+Test&from=Shyn&age=24';
  for (const experience of orderedExperiences.filter(({ status }) => status === 'published')) {
    const card = page.locator(`.gift-card-${experience.id}`);
    await expect(card).toHaveAttribute('href', `${experience.route}${expectedQuery}`);

    const destination = await card.getAttribute('href');
    const response = await page.request.get(new URL(destination, chooserURL).href);
    expect(response.status()).toBe(200);
    expect(response.url()).not.toContain('privateNote');
    expect(response.url()).not.toContain('private-fragment');
  }

  for (const experience of orderedExperiences.filter(({ status }) => status !== 'published')) {
    await expect(page.locator(`.gift-card-${experience.id}`)).not.toHaveAttribute('href', /.+/);
  }
});

test('a missing preview keeps the published card readable and actionable', async ({
  baseURL,
  page,
}) => {
  const publishedExperience = orderedExperiences.find(({ status }) => status === 'published');
  if (!publishedExperience) throw new Error('Registry must contain a published experience.');

  await page.goto(new URL('../', baseURL).href);
  const card = page.locator(`.gift-card-${publishedExperience.id}`);
  await card.locator('.gift-media img').evaluate(image => {
    image.setAttribute('src', '/__e2e__/missing-preview.webp');
  });

  await expect(card.locator('.gift-media')).toHaveClass(/is-unavailable/);
  await expect(card.locator('.gift-title')).toHaveText(publishedExperience.title);
  await expect(card.locator('.gift-description')).toHaveText(publishedExperience.description);
  await expect(card).toHaveAttribute('href', publishedExperience.route);
});
