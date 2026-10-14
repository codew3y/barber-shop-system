/* BarberHouse push service worker (Phase 4.3). Served from /sw.js so its
   scope covers the whole app. Shows booking notifications even when no
   tab is open; tapping one opens the booking. */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'BarberHouse';
  const options = {
    body: data.body || 'Something changed with your booking.',
    icon: '/barberlogo-icon-v2.jpg',
    badge: '/barberlogo-icon-v2.jpg',
    data: { url: data.url || '/dashboard' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if (win.url.includes(url) && 'focus' in win) return win.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
