const CACHE_VERSION = '__BUILD_CACHE_VERSION__';
const CACHE_NAME = `static-${CACHE_VERSION}`;
const SCOPE_URL = new URL('./', self.location.href);
const INDEX_URL = new URL('index.html', SCOPE_URL).href;
const BUILD_ASSET_PATHS = /*__BUILD_ASSETS__*/ [];
const BUILD_ASSETS = BUILD_ASSET_PATHS.map(path =>
  new URL(path, SCOPE_URL).href
);

const APP_SHELL = [
  INDEX_URL,
  new URL('manifest.webmanifest', SCOPE_URL).href,
  new URL('favicon.svg', SCOPE_URL).href,
  new URL('icons/icon-192.png', SCOPE_URL).href,
  new URL('icons/icon-512.png', SCOPE_URL).href,
  ...BUILD_ASSETS,
];

const STATIC_DESTINATIONS = new Set([
  'audio',
  'document',
  'font',
  'image',
  'manifest',
  'script',
  'style',
  'worker',
]);

function isCameraRequest(request, url) {
  return request.destination === 'video'
    || /\/(?:camera|webcam)(?:\/|$)/i.test(url.pathname)
    || url.pathname.includes('/vendor/mediapipe/');
}

function canCache(request, url) {
  return request.method === 'GET'
    && url.origin === self.location.origin
    && !request.headers.has('range')
    && STATIC_DESTINATIONS.has(request.destination)
    && !isCameraRequest(request, url);
}

function cacheKeyFor(url) {
  const cacheUrl = new URL(url.href);
  cacheUrl.search = '';
  cacheUrl.hash = '';
  return cacheUrl.href;
}

async function staticFirst(request) {
  const url = new URL(request.url);
  const cacheKey = cacheKeyFor(url);
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.status === 200 && response.type === 'basic') {
      await cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (error) {
    if (request.mode === 'navigate') {
      const fallback = await cache.match(INDEX_URL);
      if (fallback) {
        return fallback;
      }
    }
    throw error;
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => (
        self.registration.active ? undefined : self.skipWaiting()
      )),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('static-birthday-keepsake-') && key !== CACHE_NAME)
          .map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (!canCache(event.request, url)) {
    return;
  }

  event.respondWith(staticFirst(event.request));
});
