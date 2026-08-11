import { expect, test } from '@playwright/test';

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

test('the chooser opens both cards and forwards only supported personalization', async ({
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

  const expectedQuery = '?to=Em+Test&from=Shyn&age=24';
  const birthdayLink = page.locator('[data-project-link][href^="/birthday/"]');
  const augustLink = page.locator('[data-project-link][href^="/august/"]');
  await expect(birthdayLink).toHaveAttribute('href', `/birthday/${expectedQuery}`);
  await expect(augustLink).toHaveAttribute('href', `/august/${expectedQuery}`);

  for (const link of [birthdayLink, augustLink]) {
    const destination = await link.getAttribute('href');
    const response = await page.request.get(new URL(destination, chooserURL).href);
    expect(response.status()).toBe(200);
    expect(response.url()).not.toContain('privateNote');
    expect(response.url()).not.toContain('private-fragment');
  }
});
