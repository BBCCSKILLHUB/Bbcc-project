// BBCC SKILL HUB — Progressive Web App Service Worker
const CACHE_NAME = 'bbcc-pwa-v1';
const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/data/branding/logo.png',
  '/classroom',
  '/login'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Network first with cache fallback for HTML and core assets
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((networkRes) => {
        return networkRes;
      })
      .catch(() => {
        return caches.match(e.request);
      })
  );
});
