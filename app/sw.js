/* NeuroNova service worker — offline app shell cache.
   Cache-first for our own assets so the app works with no connection
   once installed. Bump CACHE when assets change to force an update. */
const CACHE = "neuronova-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/storage.js",
  "./js/engine.js",
  "./js/app.js",
  "./js/games/memory-matrix.js",
  "./js/games/speed-match.js",
  "./js/games/math-blitz.js",
  "./js/games/reaction.js",
  "./js/games/n-back.js",
  "./js/games/color-match.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request)
        .then((res) => {
          // runtime-cache same-origin GETs
          if (res && res.ok && new URL(e.request.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
