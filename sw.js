// Minimal offline cache: everything needed to boot is static, so a simple
// cache-first strategy with versioned cache name is enough.
const CACHE_NAME = "jade-mahjong-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/tiles-data.js",
  "./js/layouts.js",
  "./js/dealer.js",
  "./js/audio.js",
  "./js/leaderboard.js",
  "./js/render.js",
  "./js/game.js",
  "./js/main.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return resp;
      }).catch(() => cached);
    })
  );
});
