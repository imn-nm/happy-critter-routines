// Minimal service worker — required for PWA installability on Android.
// Bump CACHE_VERSION on each deploy to purge stale caches.

const CACHE_VERSION = 2;
const CACHE_NAME = 'petpals-v' + CACHE_VERSION;

self.addEventListener('install', (event) => {
  // Activate immediately — don't wait for old SW to release
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete all old caches so the new version takes effect
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Network-first — always try fresh content, fall back to cache only if offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
