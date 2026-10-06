// Minimal offline cache: everything needed to boot is static, so a simple
// cache-first strategy with a versioned cache name is enough. Bump VERSION
// on every deploy that changes any cached asset — that's what makes the
// browser notice this file differs and kick off the update-available flow
// in main.js (see the SKIP_WAITING message handler below).
const VERSION = "12";
const CACHE_NAME = `jade-mahjong-v${VERSION}`;
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
  // Deliberately no self.skipWaiting() here: a newly installed worker
  // should sit in "waiting" state until the page asks it to take over
  // (via the SKIP_WAITING message below), so main.js can show an
  // "update available" prompt instead of silently swapping code out from
  // under a page that's mid-game.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
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
