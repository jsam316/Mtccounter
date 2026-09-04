// Stamped automatically on every push to main by
// .github/workflows/stamp-sw-version.yml (date + commit SHA), so deploys
// always bust the cache. Bump by hand only when testing locally.
const CACHE_VERSION = 'v2026-09-04-dev';
const CACHE_NAME = 'mtc-counter-' + CACHE_VERSION;
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.svg',
  './apple-touch-icon.png',
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
  './src/lectionary.js',
  './src/assist.js',
  './vendor/jspdf.umd.min.js',
  // Note: vendor/tf.min.js and vendor/coco-ssd.min.js are deliberately NOT
  // precached (~1.5 MB) — the fetch handler runtime-caches them on first
  // use of Count Assist, keeping the base install small.
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('Service Worker installing...', CACHE_NAME);
  // If any precache fetch fails, let the install fail: the previous,
  // fully-working worker stays active rather than shipping a partial cache
  // that breaks offline use. The browser retries on the next update check.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache:', CACHE_NAME);
        return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'})));
      })
  );
  // Note: no skipWaiting() here. The new worker waits until the user accepts
  // the in-app update notification (SKIP_WAITING message below) or all tabs
  // are closed. Activating immediately would force-reload open clients and
  // could interrupt an in-progress count.
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
    .then(clients => clients.forEach(client => {
      client.postMessage({ type: 'CACHE_UPDATED', version: CACHE_VERSION, hadOldCaches });
      // Reloading is handled by the page's controllerchange listener (inline
      // in index.html, so it exists even if the module failed to load).
    }))
  );
});

// Fetch event - Network first for HTML, cache first for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  const isNavigation = event.request.mode === 'navigate'
    || event.request.headers.get('accept')?.includes('text/html');

  if (isNavigation) {
    const path = url.pathname;
    const isAppShell = path.endsWith('/') || path.endsWith('/index.html');

    if (isAppShell) {
      // App shell is served from the SAME versioned cache as the JS modules,
      // so HTML and scripts can never be out of step (a network-fresh
      // index.html paired with stale cached modules was breaking refreshes).
      // New versions arrive atomically via the service worker update flow.
      event.respondWith(
        caches.match('./index.html').then(cached => cached || fetch(event.request))
      );
      return;
    }

    // Other pages (privacy, support): network first, cache fallback.
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          return response;
        })
        .catch(() => caches.match(event.request))
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
