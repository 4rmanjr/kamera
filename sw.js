const CACHE_NAME = 'geo-camera-pro-v6';
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available, otherwise fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});