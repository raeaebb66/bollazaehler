// Bolla-Zähler: Offline-Cache.
// Geänderte Dateien holt die App beim Öffnen im Hintergrund und zeigt sie beim nächsten Start.
// Wurden Dateien hinzugefügt oder entfernt, VERSION erhöhen (und APP_VERSION in index.html).
const VERSION = 4;
const CACHE = 'bolla-v' + VERSION;
const CORE = ['./', './index.html'];
const EXTRA = ['./manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

// Nur die Kerndateien sind Pflicht. Fehlt ein Icon, läuft der Offline-Modus trotzdem.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(async c => {
        await c.addAll(CORE);
        await Promise.allSettled(EXTRA.map(u => c.add(u)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('bolla-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Aus dem Cache antworten; online im Hintergrund auffrischen.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => {
        const frisch = fetch(req, { cache: 'no-cache' }).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => hit || (req.mode === 'navigate' ? cache.match('./index.html') : null) || Response.error());
        return hit || frisch;
      })
    )
  );
});
