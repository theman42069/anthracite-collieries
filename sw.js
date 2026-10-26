/* Offline support. Keeps a copy of the site's pages, scripts and data so it opens with no signal,
   and keeps each photo once it has been seen (or all of them, from Settings → Use offline).
   Pages and data are fetched fresh when online, so updates still show up right away.
   Map background images are left to the browser: their providers don't allow storing them. */
'use strict';

var VERSION = 'v1';
var SHELL = 'collieries-shell-' + VERSION;
var PHOTOS = 'collieries-photos';   // kept across versions; photo files don't change

var FILES = [
  './', 'index.html', 'memorial.html', 'stats.html', 'quiz.html', 'sources.html', 'about.html',
  'settings.html', 'contribute.html', 'print.html', 'secret.html',
  'css/style.css', 'css/print-sheet.css',
  'js/settings-store.js', 'js/util.js', 'js/menu.js', 'js/app.js', 'js/secrets.js', 'js/memorial.js',
  'js/stats.js', 'js/quiz.js', 'js/sources.js', 'js/settings-page.js', 'js/contribute.js', 'js/print.js',
  'data/collieries.geojson', 'data/memorial.json', 'data/glossary.json', 'data/quiz-extra.json', 'data/railroads.geojson',
  'icons/headframe.svg', 'icons/no-photo.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png', 'manifest.webmanifest',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('collieries-shell-') === 0 && k !== SHELL; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Online first, so edits to the site and its data appear at once; the stored copy is the fallback.
function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res.ok) {
      var copy = res.clone();
      caches.open(SHELL).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error());
    });
  });
}

// Stored first: photos, fonts and library files don't change once published.
function cacheFirst(req, cacheName) {
  return caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (res.ok || res.type === 'opaque') {
        var copy = res.clone();
        caches.open(cacheName).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(/\/photos\//.test(url.pathname) ? cacheFirst(req, PHOTOS) : networkFirst(req));
  } else if (/^(unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) {
    e.respondWith(cacheFirst(req, SHELL));
  }
  // Everything else (map tiles, aerial photos, newspaper scans) goes straight to the network.
});
