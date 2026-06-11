// sw.js — Service Worker minuteur muscu
// Rôle : programmer la notification de fin de repos À L'AVANCE, pour qu'Android
// la déclenche tout seul même si Chrome est en arrière-plan / sur une autre appli.
const TAG = 'rest-timer';
let fallbackTimer = null; // setTimeout de repli — doit être annulable (pause/reset/nouveau repos)

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function show(title, body, opts) {
  return self.registration.showNotification(title, Object.assign({
    body: body,
    tag: TAG,
    renotify: true,
    silent: false,
    vibrate: [300, 150, 300, 150, 600]
  }, opts || {}));
}

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'SCHEDULE') {
    if ('TimestampTrigger' in self) {
      // Notif programmée par l'OS → sonne même page gelée / autre appli
      show(d.title, d.body, { showTrigger: new TimestampTrigger(d.when) }).catch(() => {});
    } else {
      // Repli : setTimeout côté SW (best-effort, peut être tué au-delà de ~30 s)
      if (fallbackTimer) clearTimeout(fallbackTimer); // un seul repos programmé à la fois
      const delay = Math.max(0, d.when - Date.now());
      fallbackTimer = setTimeout(() => { fallbackTimer = null; show(d.title, d.body); }, delay);
    }
  } else if (d.type === 'NOTIFY') {
    show(d.title, d.body, { renotify: false });
  } else if (d.type === 'CANCEL') {
    if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; } // sinon : notif fantôme après pause/reset
    self.registration.getNotifications({ tag: TAG, includeTriggered: true })
      .then((ns) => ns.forEach((n) => n.close()))
      .catch(() => {});
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cl) => {
    for (const c of cl) { if ('focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow('./index.html');
  }));
});
