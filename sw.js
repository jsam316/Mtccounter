// IMPORTANT: Update this version number every time you deploy!
// Format: YYYY-MM-DD-HH-MM (or increment manually)
const CACHE_VERSION = 'v2026-05-31-02';
const CACHE_NAME = 'mtc-counter-' + CACHE_VERSION;
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './src/main.js',
  './src/state.js',
  './src/translations.js',
  './src/bibleData.js',
  './src/utils.js',
  './src/haptic.js',
  './src/language.js',
  './src/scripture.js',
  './src/counter.js',
  './src/history.js',
  './src/celebrants.js',
  './src/parishes.js',
  './src/export.js',
  './src/stats.js',
  './src/ui.js',
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('Service Worker installing...', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache:', CACHE_NAME);
        return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'})));
      })
      .catch(err => {
        console.log('Cache addAll error:', err);
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...', CACHE_NAME);
  let hadOldCaches = false;
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName.startsWith('mtc-counter-') && cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            hadOldCaches = true;
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(clients => Promise.all(clients.map(client => {
      client.postMessage({ type: 'CACHE_UPDATED', version: CACHE_VERSION });
      // Force-reload any client that may be stuck on an old cached version.
      // This handles clients whose module failed to load (so they have no
      // controllerchange listener) — e.g. after the /src/main.js path fix.
      if (hadOldCaches && client.navigate) {
        return client.navigate(client.url);
      }
    })))
  );
});

// Fetch event - Network first for HTML, cache first for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Network-first strategy for HTML navigation requests (always check for updates)
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update cache with new version
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Cache-first for other assets (CSS, JS, images)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          // Return cached version
          return response;
        }

        return fetch(event.request).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone and cache the response
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
      .catch(() => {
        // If both cache and network fail, show offline page
        return caches.match('./index.html');
      })
  );
});

// Handle messages from the client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
