// Bump this version any time you edit index.html and re-deploy,
// so the iPad picks up the new version instead of serving the old cached copy.
var CACHE_NAME = 'pbfa-concession-v6';

var ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Cache each asset independently so one failure (e.g. a missing icon)
      // doesn't silently abort caching for everything else.
      return Promise.all(
        ASSETS_TO_CACHE.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.error('[SW] Failed to cache', url, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Cache-first with an app-shell fallback: if a page navigation (e.g. the
// Home Screen shortcut hitting "/index.html") doesn't have an exact cache
// match, fall back to whichever variant of the app ("./" or "./index.html")
// we do have cached, instead of failing outright when offline.
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  var isNavigation = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').indexOf('text/html') !== -1;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request).then(function (response) {
        if (response && response.status === 200) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(function () {
        if (isNavigation) {
          return caches.match('./index.html').then(function (shell) {
            return shell || caches.match('./');
          });
        }
        return cached;
      });
    })
  );
});
