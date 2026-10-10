/* Network-first service worker for the headprint demo.
 * - Tries the network first (so edits and deploys show up immediately).
 * - Falls back to the cache when offline or when the network is slow.
 * - Caches same-origin static assets as they are fetched; never caches API calls.
 * Generated from the folder contents; regenerate when files are added. */
var CACHE = 'headprint-v1';
var NETWORK_TIMEOUT_MS = 4000;
var PRECACHE = [
  "./",
  "./app.js",
  "./favicon.png",
  "./styles.css"
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(url).catch(function () { /* optional asset */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE && k.indexOf('headprint-') === 0; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isCacheable(req) {
  if (req.method !== 'GET') return false;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.indexOf('/api/') !== -1) return false;
  return true;
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (!isCacheable(req)) return;
  event.respondWith(
    new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        caches.match(req, { ignoreSearch: true }).then(function (cached) {
          if (cached && !settled) { settled = true; resolve(cached); }
        });
      }, NETWORK_TIMEOUT_MS);
      fetch(req).then(function (res) {
        clearTimeout(timer);
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        if (!settled) { settled = true; resolve(res); }
      }).catch(function () {
        clearTimeout(timer);
        caches.match(req, { ignoreSearch: true }).then(function (cached) {
          if (settled) return;
          settled = true;
          if (cached) return resolve(cached);
          if (req.mode === 'navigate') {
            return caches.match('./').then(function (shell) {
              resolve(shell || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }));
            });
          }
          resolve(new Response('', { status: 504 }));
        });
      });
    })
  );
});
