const CACHE='todavia-market-v10-3';
const OLD_CACHES=['todavia-market-v8','todavia-market-v9','todavia-market-v10','todavia-market-v10-1','todavia-market-v10-2'];
const ASSETS=['./','./index.html','./manifest.json','./icon.svg','./business-manager.js','./google-apps-script.js'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // HTML/app shell: ALWAYS prefer the network so a new deployment is picked up.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(event.request, {cache:'no-store'})
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy)).catch(()=>{});
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Other local assets: cache first, then network.
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(()=>{});
        return response;
      }))
      .catch(() => caches.match('./index.html'))
  );
});
