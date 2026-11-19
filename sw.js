/* MOA Village v2 — app shell cache */
const CACHE = 'moa-village-v2';
const ASSETS = [
  './',
  './index.html',
  './assets/css/style.css',
  './assets/js/i18n.js',
  './assets/js/catalog.js',
  './assets/js/store.js',
  './assets/js/world.js',
  './assets/js/scene.js',
  './assets/js/missions.js',
  './assets/js/ui.js',
  './assets/js/app.js',
  './data/trending-items.json',
  './manifest.webmanifest',
  './icons/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  /* pages: network first so a new deploy shows up immediately, cache as offline fallback */
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // trending data: network first so the hourly update shows, cache as fallback
  if (url.pathname.endsWith('/data/trending-items.json')) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
