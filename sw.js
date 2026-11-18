// Bolla-Zähler: Offline-Cache.
// Geänderte Dateien holt die App beim Öffnen im Hintergrund und zeigt sie beim nächsten Start.
// Bei jeder neuen Fassung VERSION erhöhen, gleicher Wert wie APP_VERSION in index.html
// (z. B. '1.1' für kleine Änderungen, '2.0' für große).
const VERSION = '1.2';
const CACHE = 'bolla-v' + VERSION;
const CORE = ['./', './index.html'];
const EXTRA = ['./manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

// 'reload' umgeht den HTTP-Cache des Browsers. Sonst kann beim Installieren eine bis zu
// einige Minuten alte Datei im neuen Cache landen.
const neuLaden = u => new Request(u, { cache: 'reload' });

// Nur die Kerndateien sind Pflicht. Fehlt ein Icon, läuft der Offline-Modus trotzdem.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(async c => {
        await c.addAll(CORE.map(neuLaden));
        await Promise.allSettled(EXTRA.map(u => c.add(neuLaden(u))));
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
// waitUntil hält den Worker am Leben, bis die Auffrischung fertig ist. Ohne das beendet
// der Browser ihn oft sofort nach der Antwort, und das Update geht verloren.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Ohne Query-String ablegen und suchen: Sonst entstehen für ?x=1 & Co. eigene Einträge,
    // und match() liefert danach dauerhaft den ältesten (veralteten).
    const key = new URL(req.url); key.search = '';
    const hit = await cache.match(key.href);
    const frisch = fetch(req, { cache: 'no-cache' }).then(async res => {
      if (res.status === 200) await cache.put(key.href, res.clone());   // 206 und Fehler nicht cachen
      return res;
    });
    if (hit) { e.waitUntil(frisch.catch(() => {})); return hit; }
    try { return await frisch; }
    catch (err) {
      return (req.mode === 'navigate' && await cache.match('./index.html')) || Response.error();
    }
  })());
});
