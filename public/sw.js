// BBCC SKILL HUB — Background Push Notification Handler
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    })
  );
  self.clients.claim();
});

// Pass-through fetch (zero stale client caching)
self.addEventListener('fetch', () => {});

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

  const isCall = (data.url && (data.url.includes('/call') || data.url.includes('call.html')));

  const options = {
    body: data.body,
    icon: data.icon || '/data/branding/logo.png',
    badge: data.badge || '/data/branding/logo.png',
    vibrate: data.vibrate || (isCall ? [500, 250, 500, 250, 500, 250, 500] : [200, 100, 200]),
    tag: isCall ? 'bbcc-live-call' : 'bbcc-notification',
    renotify: true,
    requireInteraction: isCall ? true : false,
    data: {
      url: data.url || '/'
    },
    actions: isCall ? [
      { action: 'open', title: 'कॉल उठाएं 📞' },
      { action: 'close', title: 'काटें ✕' }
    ] : [
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
