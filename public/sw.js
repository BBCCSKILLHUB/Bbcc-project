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

// ============================================================
// WEB PUSH NOTIFICATION RECEIVER & CLICK HANDLER
// ============================================================
self.addEventListener('push', (event) => {
  let data = {
    title: 'BBCC SKILL HUB',
    body: 'नया अपडेट उपलब्ध है। देखने के लिए टैप करें।',
    icon: '/data/branding/logo.png',
    badge: '/data/branding/logo.png',
    url: '/'
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/data/branding/logo.png',
    badge: data.badge || '/data/branding/logo.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'देखें 📖' },
      { action: 'close', title: 'बंद करें ✕' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

