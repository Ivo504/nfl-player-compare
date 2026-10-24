/* NFL Player Compare service worker: lets the installed app open offline.
   Data and code files carry the build stamp in their URL (?v=...), so a cached copy never goes stale: cache-first.
   The page itself is network-first, so a new daily build shows up as soon as you're online. */
var CACHE = 'nflcompare-__BUILD__';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icons/icon-192.png'];

// on install, cache the page plus every script it loads, so the app opens offline after the first visit
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(SHELL).then(function () { return c.match('index.html'); }).then(function (res) { return res ? res.text() : ''; }).then(function (html) {
      var urls = [], re = /<script src="([^"]+)"/g, m;
      while ((m = re.exec(html))) urls.push(m[1]);
      return Promise.all(urls.map(function (u) { return c.add(u).catch(function () { /* skip a file that fails; it caches on first use */ }); }));
    });
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('nflcompare-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put('index.html', copy); });
      return res;
    }).catch(function () { return caches.match('index.html').then(function (r) { return r || caches.match('./'); }); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res.ok && (url.search.indexOf('v=') >= 0 || /\.(png|svg|woff2|webmanifest)$/.test(url.pathname))) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  }));
});
