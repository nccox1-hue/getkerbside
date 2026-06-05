const CACHE = 'kerbside-v1';
const STATIC = ['/', '/css/style.css', '/js/app.js', '/js/api.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
});

self.addEventListener('fetch', event => {
  // API calls: network-first, no caching
  if (event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
