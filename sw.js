/* Wrestle World service worker: precaches the whole (single-file) game so it plays fully offline.
   The cache name carries a content hash that build.sh stamps in on every build; a new build => new sw.js bytes
   => the browser installs it, it takes over, and old caches are deleted. */
const VERSION = '949bf765b8e3';
const PREFIX = 'wrestle-world-';
const CACHE = PREFIX + VERSION;
const ASSETS = ["./", "index.html", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-192.png", "icons/icon-maskable-512.png", "icons/favicon-32.png"];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'version' && event.source) event.source.postMessage({ version: VERSION });
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // App shell: always answer from the cache (instant + offline); fall back to the network if the cache is missing.
    event.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(req, { ignoreSearch: true })
          .then(hit => hit || cache.match('./index.html'))
          .then(hit => hit || fetch(req))
      )
    );
    return;
  }
  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
        if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
      }))
    )
  );
});
