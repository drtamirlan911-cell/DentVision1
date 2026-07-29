const CACHE = 'dv-v3';
const PRECACHE_URLS = ['/', '/shop', '/offline'];
const IGNORE_PATHS = ['/api/auth', '/api/shop/product-presets/quick-add', '/@vite/', '/@react-refresh'];

function shouldIgnore(url) {
  return IGNORE_PATHS.some(p => url.includes(p));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (event.request.method !== 'GET' || shouldIgnore(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/offline').then((r) => r || new Response('Offline', { status: 503 })));
    })
  );
});