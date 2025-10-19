const CACHE_NAME = 'primonotes-v1';
const STATIC_CACHE = 'primonotes-static-v1';
const DYNAMIC_CACHE = 'primonotes-dynamic-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            return response;
          })
          .catch(() => {
            return new Response(
              JSON.stringify({ error: 'Offline', offline: true }),
              {
                headers: { 'Content-Type': 'application/json' },
                status: 503
              }
            );
          })
      );
    } else if (request.mode === 'navigate') {
      event.respondWith(
        caches.match('/index.html').then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch('/index.html').then((response) => {
            if (!response || response.status !== 200) {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put('/index.html', responseToCache);
            });

            return response;
          }).catch(() => {
            return new Response('Offline - App not cached', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
        })
      );
    } else {
      event.respondWith(
        caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(request).then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });

            return response;
          });
        })
      );
    }
  } else {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        return cachedResponse || fetch(request);
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
