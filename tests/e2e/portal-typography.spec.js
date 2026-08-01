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
