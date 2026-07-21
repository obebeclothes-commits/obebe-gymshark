var CACHE = 'obebe-v20260721';
var SHELL = [
    './',
    './index.html',
    './styles.css',
    './critical.css',
    './PORTADA1.jpeg'
];

var NETWORK_FIRST = /productos-(hombre|mujer)\.js(\?|$)|stock-sheet\.js(\?|$)|mercadolibre-listings\.json(\?|$)/;

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE).then(function(cache) {
            return cache.addAll(SHELL).catch(function() {});
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) {
                return caches.delete(k);
            }));
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;
    var url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    if (NETWORK_FIRST.test(url.pathname + (url.search || ''))) {
        event.respondWith(
            fetch(event.request).then(function(res) {
                return res;
            }).catch(function() {
                return caches.match(event.request);
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(function(cached) {
            var network = fetch(event.request).then(function(res) {
                if (res && res.ok) {
                    var copy = res.clone();
                    caches.open(CACHE).then(function(cache) { cache.put(event.request, copy); });
                }
                return res;
            }).catch(function() {
                return cached;
            });
            return cached || network;
        })
    );
});
