const CACHE_NAME = 'padel-calendar-v3';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ── INSTALL ───────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 &&
          (event.request.url.startsWith(self.location.origin) ||
           event.request.url.includes('fonts.googleapis.com') ||
           event.request.url.includes('fonts.gstatic.com') ||
           event.request.url.includes('gstatic.com'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.destination === 'document')
          return caches.match('./index.html');
      });
    })
  );
});

// ── PUSH — Firebase Cloud Messaging ───────────
// Este evento se dispara cuando FCM envía una notificación
// aunque la app esté completamente cerrada
self.addEventListener('push', event => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch(e) { data = { title: '🎾 Padel Calendar', body: event.data.text() }; }

  const title = data.title || '🎾 Padel Calendar';
  const options = {
    body:    data.body    || '',
    icon:    data.icon    || './icon-512.png',
    badge:                   './icon-192.png',
    vibrate: [200, 100, 200],
    tag:     data.tag     || 'padel-notif',
    renotify: true,
    data: { url: './' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── MESSAGE — programar notif desde la app ────
// Recibe la notificación más próxima y la dispara con setTimeout
// Funciona cuando el SW está vivo (app en segundo plano reciente)
let scheduledTimer = null;

self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'SCHEDULE_ONE_NOTIF') {
    const { trigMs, title, body, tag } = event.data;
    const delay = trigMs - Date.now();
    if (delay <= 0) return;

    // Cancelar timer anterior si existe
    if (scheduledTimer) { clearTimeout(scheduledTimer); scheduledTimer = null; }

    scheduledTimer = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon:    './icon-512.png',
        badge:   './icon-192.png',
        vibrate: [200, 100, 200],
        tag,
        renotify: true,
        data: { url: './' }
      });
      scheduledTimer = null;
    }, delay);
  }
});

// ── NOTIFICATION CLICK ────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
