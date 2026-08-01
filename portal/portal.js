const forwardedKeys = ["to", "from", "age"];
const sourceParams = new URLSearchParams(window.location.search);
const forwardedParams = new URLSearchParams();

for (const key of forwardedKeys) {
  for (const value of sourceParams.getAll(key)) {
    forwardedParams.append(key, value);
  }
}

const forwardedQuery = forwardedParams.toString();

for (const link of document.querySelectorAll("[data-project-link]")) {
  const baseHref = link.getAttribute("href");
  link.setAttribute("href", forwardedQuery ? `${baseHref}?${forwardedQuery}` : baseHref);
}

for (const image of document.querySelectorAll(".gift-media img")) {
  image.addEventListener(
    "error",
    () => {
      image.closest(".gift-media")?.classList.add("is-unavailable");
    },
    { once: true },
  );
}

const retiredBirthdayCachePrefixes = [
  "static-birthday-album-",
  "static-birthday-keepsake-",
];

function isRetiredBirthdayCache(cacheName) {
  return retiredBirthdayCachePrefixes.some((prefix) =>
    cacheName.startsWith(prefix),
  );
}

async function isLegacyRootCache(cacheName, rootIndexUrl) {
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    return requests.some((request) => request.url === rootIndexUrl);
  } catch {
    return false;
  }
}

async function deleteLegacyRootCaches(scopeUrl) {
  if (!("caches" in window)) return;

  const rootIndexUrl = new URL("index.html", scopeUrl).href;
  const cacheNames = await caches.keys();
  const legacyRootCaches = await Promise.all(
    cacheNames.filter(isRetiredBirthdayCache).map(async (cacheName) => ({
      cacheName,
      belongsToRoot: await isLegacyRootCache(cacheName, rootIndexUrl),
    })),
  );
  await Promise.allSettled(
    legacyRootCaches
      .filter(({ belongsToRoot }) => belongsToRoot)
      .map(({ cacheName }) => caches.delete(cacheName)),
  );
}

async function retireLegacyRootWorker() {
  if (!("serviceWorker" in navigator)) return;

  const scopeUrl = new URL("./", window.location.href);
  const registration = await navigator.serviceWorker.getRegistration(scopeUrl.href);
  if (!registration || registration.scope !== scopeUrl.href) return;

  const controlledByLegacyWorker = Boolean(navigator.serviceWorker.controller);
  try {
    await deleteLegacyRootCaches(scopeUrl);
  } finally {
    const unregistered = await registration.unregister();
    if (unregistered && controlledByLegacyWorker) {
      window.location.reload();
    }
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    () => {
      void retireLegacyRootWorker().catch(() => {
        // Cleanup is best effort; the chooser remains usable without it.
      });
    },
    { once: true },
  );
}
