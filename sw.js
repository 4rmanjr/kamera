const STATIC_CACHE_NAME = 'geo-camera-pro-static-v7';
const ASSETS_CACHE_NAME = 'geo-camera-pro-assets-v7';
const urlsToCache = [
  '/',
  '/index.html',
  '/js/main.js',
  '/js/container.js',
  '/js/dom.js',
  '/js/eventBus.js',
  '/js/state.js',
  '/js/storage.js',
  '/js/camera.js',
  '/js/location.js',
  '/js/canvasProcessor.js',
  '/js/gallery.js',
  '/js/preview.js',
  '/js/ui.js',
  '/js/utils.js',
  '/js/qrCodeGenerator.js',
  '/js/notificationService.js',
  '/js/qrcode.min.js',
  '/css/tailwind.css',
  '/css/phosphor-icons/style.css',
  '/css/phosphor-icons/Phosphor.svg',
  '/css/phosphor-icons/Phosphor.ttf',
  '/css/phosphor-icons/Phosphor.woff',
  '/css/phosphor-icons/Phosphor.woff2',
  '/icon.png',
  '/icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Opened static assets cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker installed');
        return self.skipWaiting(); // Immediately take control of the page
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME &&
              cacheName !== ASSETS_CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('Service Worker activated and old caches cleaned up');
      return self.clients.claim(); // Take control of all clients immediately
    })
  );
});

// Fetch event - handle different types of requests differently
self.addEventListener('fetch', (event) => {
  // Don't cache certain requests
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // For API requests or other non-static assets, use network-first strategy
  if (event.request.url.includes('/api/') ||
      event.request.url.includes('maps.googleapis.com')) {
    event.respondWith(
      caches.open(ASSETS_CACHE_NAME)
        .then(cache => fetch(event.request)
          .then(response => {
            // If request was successful, cache it
            if (response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => {
            // If network fails, try to return cached version
            return cache.match(event.request);
          })
        )
    );
    return;
  }

  // For image requests (could be photos from the app), use cache-first strategy with network fallback
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // Return cached version if available, otherwise fetch from network
          if (response) {
            return response;
          }
          return fetch(event.request)
            .then((networkResponse) => {
              // If request was successful, cache it for future use
              if (networkResponse.status === 200) {
                caches.open(ASSETS_CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                  });
              }
              return networkResponse;
            })
            .catch(error => {
              console.error('Failed to fetch image:', event.request.url, error);
              // Return a fallback image if available
              return caches.match('/icon.png'); // fallback to app icon
            });
        })
    );
    return;
  }

  // For static assets, use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available, otherwise fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            // If request was successful, cache it
            if (networkResponse.status === 200) {
              caches.open(STATIC_CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, networkResponse.clone());
                });
            }
            return networkResponse;
          });
      })
  );
});