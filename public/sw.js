// One cache per build. The id comes from the `?v=` on the registration URL, so
// a new release gets a new cache and `activate` deletes the old one. A single
// fixed name would keep the first deployment's app shell forever, and that
// shell points at chunk filenames later builds no longer have.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_NAME = `nets-pay-together-${VERSION}`;

// Only files whose contents are stable across releases are precached. `/` and
// `/login` are deliberately absent: their HTML names hashed chunks, so a copy
// of it kept from an earlier build is worse than no copy at all. The navigation
// handler below caches whatever the network last returned, which is always the
// shell for the build actually running.
const APP_SHELL = ['/offline.html', '/manifest.webmanifest', '/nets-icon.svg', '/nets-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/')) || caches.match('/offline.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && ['script', 'style', 'image', 'font', 'worker'].includes(request.destination)) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
