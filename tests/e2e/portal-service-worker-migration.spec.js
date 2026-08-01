import { expect, test } from '@playwright/test';

const desktopMigrationProjects = new Set([
  'desktop-chrome',
  'desktop-firefox',
  'desktop-safari',
]);

async function expectRootCacheRetired(page, cacheName, projectName) {
  if (projectName === 'desktop-safari') {
    await expect
      .poll(() =>
        page.evaluate(async name => {
          if (!(await caches.keys()).includes(name)) return 0;
          return (await (await caches.open(name)).keys()).length;
        }, cacheName),
      )
      .toBe(0);
    return;
  }

  await expect
    .poll(() => page.evaluate(() => caches.keys()))
    .not.toContain(cacheName);
}

test('the chooser migration removes only legacy root birthday caches', async ({
  baseURL,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'Low-level cache selection is exercised once in desktop Chrome.',
  );

  const chooserURL = new URL('../', baseURL);
  const fixtureClientURL = new URL('__e2e__/client.html', chooserURL);
  const migrationWorkerURL = new URL(
    'service-worker.js?e2e=legacy-cache-migration',
    chooserURL,
  );
  const legacyRootIndexURL = new URL('index.html', chooserURL).href;
  const currentBirthdayIndexURL = new URL('birthday/index.html', chooserURL).href;
  const legacyCacheNames = [
    'static-birthday-album-e2e-legacy-root',
    'static-birthday-keepsake-e2e-legacy-root',
  ];
  const currentBirthdayCacheName =
    'static-birthday-keepsake-e2e-current-birthday';

  await page.goto(fixtureClientURL.href);
  await page.evaluate(
    async ({ currentCache, currentIndex, legacyCaches, legacyIndex }) => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));

      await Promise.all([
        ...legacyCaches.map(async cacheName => {
          const cache = await caches.open(cacheName);
          await cache.put(legacyIndex, new Response('legacy root birthday'));
        }),
        (async () => {
          const cache = await caches.open(currentCache);
          await cache.put(currentIndex, new Response('current nested birthday'));
        })(),
      ]);
    },
    {
      currentCache: currentBirthdayCacheName,
      currentIndex: currentBirthdayIndexURL,
      legacyCaches: legacyCacheNames,
      legacyIndex: legacyRootIndexURL,
    },
  );

  await page.evaluate(
    ({ scope, worker }) => {
      void navigator.serviceWorker.register(worker, {
        scope,
        updateViaCache: 'none',
      });
    },
    {
      scope: chooserURL.href,
      worker: migrationWorkerURL.href,
    },
  );

  await expect
    .poll(() => page.evaluate(() => caches.keys()))
    .not.toContain(legacyCacheNames[0]);
  await expect
    .poll(() => page.evaluate(() => caches.keys()))
    .not.toContain(legacyCacheNames[1]);
  await expect
    .poll(() => page.evaluate(() => caches.keys()))
    .toContain(currentBirthdayCacheName);
});

test('root migration preserves the nested birthday worker and offline shell', async ({
  baseURL,
  context,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'Nested offline coexistence is exercised once in desktop Chrome.',
  );

  const birthdayScopeURL = new URL('./', baseURL);
  const chooserURL = new URL('../', baseURL);
  const fixtureClientURL = new URL('__e2e__/client.html', chooserURL);
  const migrationWorkerURL = new URL(
    'service-worker.js?e2e=preserve-nested-offline-shell',
    chooserURL,
  );

  await page.goto(birthdayScopeURL.href);
  await page.evaluate(async expectedScope => {
    const registration = await navigator.serviceWorker.ready;
    if (registration.scope !== expectedScope) {
      throw new Error(`Unexpected service-worker scope: ${registration.scope}`);
    }
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, {
          once: true,
        });
      });
    }
  }, birthdayScopeURL.href);

  await page.goto(fixtureClientURL.href);
  await page.evaluate(
    async ({ scope, worker }) => {
      await navigator.serviceWorker.register(worker, {
        scope,
        updateViaCache: 'none',
      });
    },
    {
      scope: chooserURL.href,
      worker: migrationWorkerURL.href,
    },
  );

  await expect
    .poll(() =>
      page.evaluate(async ({ birthdayScope, chooserScope }) => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return {
          hasBirthdayWorker: registrations.some(
            registration => registration.scope === birthdayScope,
          ),
          hasRootWorker: registrations.some(
            registration => registration.scope === chooserScope,
          ),
        };
      }, {
        birthdayScope: birthdayScopeURL.href,
        chooserScope: chooserURL.href,
      }),
    )
    .toEqual({
      hasBirthdayWorker: true,
      hasRootWorker: false,
    });

  await page.goto(birthdayScopeURL.href);
  await expect(page.getByRole('heading', { name: /Dành cho/i })).toBeVisible();

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { name: /Dành cho/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Tiếp tục trong yên lặng/i }),
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test('the chooser migration retires its root service-worker registration', async ({
  baseURL,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'Low-level registration retirement is exercised once in desktop Chrome.',
  );

  const chooserURL = new URL('../', baseURL);
  const fixtureClientURL = new URL('__e2e__/client.html', chooserURL);
  const migrationWorkerURL = new URL(
    'service-worker.js?e2e=registration-retirement',
    chooserURL,
  );

  await page.goto(fixtureClientURL.href);
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  });

  await page.evaluate(
    ({ scope, worker }) => {
      void navigator.serviceWorker.register(worker, {
        scope,
        updateViaCache: 'none',
      });
    },
    {
      scope: chooserURL.href,
      worker: migrationWorkerURL.href,
    },
  );

  await expect
    .poll(() =>
      page.evaluate(async scope => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.filter(registration => registration.scope === scope).length;
      }, chooserURL.href),
    )
    .toBe(0);
});

test('a fresh chooser loads once without installing a root service worker', async ({
  baseURL,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chrome',
    'Fresh chooser registration behavior is exercised once in desktop Chrome.',
  );

  const chooserURL = new URL('../', baseURL);
  let chooserNavigations = 0;
  page.on('framenavigated', frame => {
    if (frame !== page.mainFrame()) return;
    const navigatedURL = new URL(frame.url());
    if (
      navigatedURL.origin === chooserURL.origin &&
      navigatedURL.pathname === chooserURL.pathname
    ) {
      chooserNavigations += 1;
    }
  });

  await page.goto(chooserURL.href);
  await expect(page).toHaveTitle('Chọn tấm thiệp dành cho em');
  await page.waitForTimeout(750);

  const rootRegistrations = await page.evaluate(async scope => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations.filter(registration => registration.scope === scope).length;
  }, chooserURL.href);

  expect(chooserNavigations).toBe(1);
  expect(rootRegistrations).toBe(0);
});

test('the chooser retires a legacy pass-through root worker', async ({
  baseURL,
  page,
}, testInfo) => {
  test.skip(
    !desktopMigrationProjects.has(testInfo.project.name),
    'Cross-browser migration is exercised once per desktop engine.',
  );

  const chooserURL = new URL('../', baseURL);
  const fixtureClientURL = new URL('__e2e__/client.html', chooserURL);
  const legacyWorkerURL = new URL(
    '__e2e__/legacy-pass-through-service-worker.js',
    chooserURL,
  );
  const legacyCacheName =
    'static-birthday-keepsake-e2e-pass-through-root';
  const currentBirthdayCacheName =
    'static-birthday-keepsake-e2e-pass-through-birthday';
  let chooserNavigations = 0;
  page.on('framenavigated', frame => {
    if (frame !== page.mainFrame()) return;
    const navigatedURL = new URL(frame.url());
    if (
      navigatedURL.origin === chooserURL.origin &&
      navigatedURL.pathname === chooserURL.pathname
    ) {
      chooserNavigations += 1;
    }
  });

  await page.goto(fixtureClientURL.href);
  await page.evaluate(
    async ({
      currentCache,
      currentIndex,
      legacyCache,
      legacyIndex,
      scope,
      worker,
    }) => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));

      const [legacyRootCache, currentBirthdayCache] = await Promise.all([
        caches.open(legacyCache),
        caches.open(currentCache),
      ]);
      await Promise.all([
        legacyRootCache.put(legacyIndex, new Response('legacy root birthday')),
        currentBirthdayCache.put(
          currentIndex,
          new Response('current nested birthday'),
        ),
      ]);

      const controllerChanged = new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, {
          once: true,
        });
      });
      await navigator.serviceWorker.register(worker, {
        scope,
        updateViaCache: 'none',
      });
      if (!navigator.serviceWorker.controller) {
        await controllerChanged;
      }
    },
    {
      currentCache: currentBirthdayCacheName,
      currentIndex: new URL('birthday/index.html', chooserURL).href,
      legacyCache: legacyCacheName,
      legacyIndex: new URL('index.html', chooserURL).href,
      scope: chooserURL.href,
      worker: legacyWorkerURL.href,
    },
  );

  await page.goto(chooserURL.href);
  await expect.poll(() => chooserNavigations).toBeGreaterThanOrEqual(2);
  await expect(page).toHaveTitle('Chọn tấm thiệp dành cho em');

  await expect
    .poll(() =>
      page.evaluate(async scope => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.filter(registration => registration.scope === scope).length;
      }, chooserURL.href),
    )
    .toBe(0);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null))
    .toBeNull();
  await expectRootCacheRetired(
    page,
    legacyCacheName,
    testInfo.project.name,
  );
  await expect
    .poll(() => page.evaluate(() => caches.keys()))
    .toContain(currentBirthdayCacheName);
});

test('a cached legacy birthday page migrates to the chooser', async ({
  baseURL,
  page,
}, testInfo) => {
  test.skip(
    !desktopMigrationProjects.has(testInfo.project.name),
    'Cross-browser migration is exercised once per desktop engine.',
  );

  const chooserURL = new URL('../', baseURL);
  const fixtureClientURL = new URL('__e2e__/client.html', chooserURL);
  chooserURL.search = new URLSearchParams({
    age: '24',
    from: 'Minh Long',
    to: 'Em Test',
  }).toString();
  const chooserScopeURL = new URL('./', chooserURL);
  const legacyWorkerURL = new URL(
    '__e2e__/legacy-cache-first-service-worker.js',
    chooserScopeURL,
  );
  const legacyCacheName = 'static-birthday-keepsake-e2e-cached-root';

  await page.goto(fixtureClientURL.href);
  await page.evaluate(
    async ({ scope, worker }) => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));

      const controllerChanged = new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, {
          once: true,
        });
      });
      await navigator.serviceWorker.register(worker, {
        scope,
        updateViaCache: 'none',
      });
      if (!navigator.serviceWorker.controller) {
        await controllerChanged;
      }
    },
    {
      scope: chooserScopeURL.href,
      worker: legacyWorkerURL.href,
    },
  );

  await page.goto(chooserURL.href);
  await expect(page).toHaveTitle('Legacy Birthday Cache');
  await expect(page).toHaveTitle('Chọn tấm thiệp dành cho em', {
    timeout: 10_000,
  });
  await expect(page).toHaveURL(chooserURL.href);

  await expectRootCacheRetired(
    page,
    legacyCacheName,
    testInfo.project.name,
  );
  await expect
    .poll(() =>
      page.evaluate(async scope => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.filter(registration => registration.scope === scope).length;
      }, chooserScopeURL.href),
    )
    .toBe(0);

  const birthdayLink = page.locator('[data-project-link][href^="./birthday/"]');
  await expect(birthdayLink).toHaveAttribute(
    'href',
    './birthday/?to=Em+Test&from=Minh+Long&age=24',
  );
});
