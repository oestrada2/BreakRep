/**
 * PushUp Hourly — Service Worker
 * Receives scheduled notification jobs from the page and fires them
 * even if the user has switched tabs (as long as the browser is open).
 */

const timers = new Map(); // id -> timeoutId

self.addEventListener('message', event => {
  const { type, notifications } = event.data ?? {};

  if (type === 'SCHEDULE') {
    // Cancel any previously scheduled timers
    timers.forEach(id => clearTimeout(id));
    timers.clear();

    const now = Date.now();
    notifications.forEach(n => {
      const delay = n.fireAt - now;
      if (delay <= 0) return;

      const tid = setTimeout(async () => {
        await self.registration.showNotification(n.title, {
          body: n.body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: String(n.id),
          renotify: true,
        });
        // Tell the page to play the alert sound / vibrate
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(c => c.postMessage({ type: 'ALERT', alertStyle: n.alertStyle }));
        timers.delete(n.id);
      }, delay);

      timers.set(n.id, tid);
    });
  }

  if (type === 'CANCEL') {
    timers.forEach(id => clearTimeout(id));
    timers.clear();
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length) return clients[0].focus();
      return self.clients.openWindow('/');
    })
  );
});
