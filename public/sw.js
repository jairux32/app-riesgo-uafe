// Service Worker para modo offline - v2.4
// El cache se invalida automáticamente con cada deploy nuevo
const CACHE_VERSION = 'v2.4-' + new Date().toISOString().slice(0,10);
const CACHE_NAME = 'app-riesgo-' + CACHE_VERSION;

// Instalación: cachear recursos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/index.html']);
    }).catch(err => console.log('SW install skip:', err))
  );
  self.skipWaiting();
});

// Activación: limpiar TODAS las caches antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first para HTML, stale-while-revalidate para assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Ignorar chrome-extension y otros esquemas no-HTTP
  if (!event.request.url.startsWith('http')) return;

  const isHTML = event.request.mode === 'navigate' ||
    event.request.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    // HTML: siempre desde red, fallback a cache
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Assets: cache primero, revalidar en background
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
              });
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
  }
});

// Sync: sincronizar datos pendientes cuando hay conexión
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-cases') {
    event.waitUntil(syncPendingCases());
  }
});

async function syncPendingCases() {
  // Notificar al cliente principal que sincronice
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_PENDING_CASES' });
  });
}
