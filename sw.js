const CACHE_NAME = 'hsk-flip-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/main.js',
  '/dashboard.js',
  '/dialog.js',
  '/hsk.js',
  '/md5.js',
  '/settings.js',
  '/srs.js',
  '/study.js',
  '/tts.js',
  '/fz_be2e0e16.ttf',
  '/list/hsk1.json',
  '/list/hsk2.json',
  '/list/hsk3.json',
  '/list/hsk4.json',
  '/list/hsk5.json',
  '/list/hsk6.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
