// Minimal service worker — required for PWA installability on Android.
// It caches the app shell on install so the "Add to Home screen" prompt
// launches in standalone mode (no browser chrome).

const CACHE_NAME = 'petpals-v1';

self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim clients so the SW takes effect right away
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy — always try the network, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
