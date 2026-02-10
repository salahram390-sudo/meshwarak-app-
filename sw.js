// sw.js (FINAL SAFE) — no missing assets
const CACHE = "meshwarak-v10"; // غيّر الرقم كل تحديث

const ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./passenger.html",
  "./driver.html",
  "./trip.html",
  "./profile.html",
  "./styles.css",
  "./app.js",
  "./manifest.json"
];

// ملفات خارجية ما نكاشّهاش (Firebase/CDN/APIs)
function isBypass(url) {
  return (
    url.startsWith("https://www.gstatic.com/") ||
    url.startsWith("https://unpkg.com/") ||
    url.startsWith("https://nominatim.openstreetmap.org/") ||
    url.includes("tile.openstreetmap.org") ||
    url.startsWith("https://www.openstreetmap.org/")
  );
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // cache what exists only
    await Promise.all(
      ASSETS.map(async (path) => {
        try {
          const res = await fetch(path, { cache: "no-store" });
          if (res.ok) await cache.put(path, res.clone());
        } catch {}
      })
    );

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = req.url;

  if (isBypass(url)) return;

  // HTML: network-first
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
        return res;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match("./index.html");
      }
    })());
    return;
  }

  // assets: cache-first
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    const res = await fetch(req);
    const cache = await caches.open(CACHE);
    cache.put(req, res.clone());
    return res;
  })());
});
