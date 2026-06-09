const CACHE = 'kerbside-v1';
const STATIC = [
  '/',
  '/css/style.css',
  '/js/app.js',
  '/js/api.js',
  '/js/benchmarks.js',
  '/manifest.json',
];

self.addEventListener('install', event => {
  // Pre-cache static shell; skip waiting so new SW activates immediately
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  // Remove old caches from previous versions, then take control immediately
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // API calls: network-first, no caching
  if (event.request.url.includes('/api/')) {
    return;
  }
  // Static shell: cache-first, fall back to network
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
