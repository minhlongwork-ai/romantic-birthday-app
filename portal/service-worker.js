const RETIRED_CACHE_PREFIXES = [
  "static-birthday-album-",
  "static-birthday-keepsake-",
];

function isRetiredBirthdayCache(cacheName) {
  return RETIRED_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix));
}

async function isRootBirthdayCache(cacheName, rootIndexUrl) {
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    return requests.some((request) => request.url === rootIndexUrl);
  } catch {
    return false;
  }
}

async function deleteRetiredRootCaches(rootIndexUrl) {
  const cacheNames = await caches.keys();
  const retiredRootCaches = await Promise.all(
    cacheNames.filter(isRetiredBirthdayCache).map(async (cacheName) => ({
      cacheName,
      belongsToRoot: await isRootBirthdayCache(cacheName, rootIndexUrl),
    })),
  );
  await Promise.all(
    retiredRootCaches
      .filter(({ belongsToRoot }) => belongsToRoot)
      .map(({ cacheName }) => caches.delete(cacheName)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const scopeUrl = new URL(self.registration.scope);
      const rootIndexUrl = new URL("index.html", scopeUrl).href;
      const openWindows = await self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .catch(() => []);

      await Promise.allSettled([
        deleteRetiredRootCaches(rootIndexUrl),
        self.clients.claim(),
        self.registration.unregister(),
      ]);

      await Promise.allSettled(
        openWindows.map((client) => {
          if (typeof client.navigate !== "function") {
            return Promise.resolve();
          }

          const clientUrl = new URL(client.url);
          const isChooserRoute =
            clientUrl.origin === scopeUrl.origin &&
            (clientUrl.pathname === scopeUrl.pathname ||
              clientUrl.pathname === `${scopeUrl.pathname}index.html`);
          if (!isChooserRoute) {
            return Promise.resolve();
          }

          return client.navigate(client.url);
        }),
      );
    })(),
  );
});
