const CACHE = 'doom-v7-strafe';
const PRECACHE = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './vendor/doom-engine.js',
  './assets/doom.jsdos',
  './assets/doom.zip',
];
const RUNTIME_CACHEABLE_HOSTS = [
  'v8.js-dos.com',
  'js-dos.com',
  'cdn.dos.zone',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(PRECACHE.map((url) => c.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const cdnAllowed = RUNTIME_CACHEABLE_HOSTS.some((h) => url.hostname.endsWith(h));
  if (!sameOrigin && !cdnAllowed) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy).catch(() => {}));
        }
        return res;
      });
    })
  );
});
