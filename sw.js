const CACHE_NAME = 'licencia-b-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './preguntas.js',
  './manifest.json',
  './icon.svg'
];

// Instalar el Service Worker y cachear recursos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activar y limpiar cachés antiguos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar peticiones y servir desde caché si no hay red
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Si está en caché, lo devuelve. Si no, lo pide a la red.
      return response || fetch(event.request);
    }).catch(() => {
      // Si falla todo (sin red y sin caché), devolvemos el index
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
