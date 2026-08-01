const RETIRED_CACHE_PREFIX = "static-birthday-album-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const openWindows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(RETIRED_CACHE_PREFIX))
          .map((cacheName) => caches.delete(cacheName)),
      );

      await self.clients.claim();

      const scopeUrl = new URL(self.registration.scope);
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
