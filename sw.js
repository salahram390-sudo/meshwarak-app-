// sw.js (FINAL SAFE)
const CACHE = "meshwarak-v10"; // ✅ غيّر الرقم كل تحديث

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
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// ملفات خارجية ما نكاشّهاش (Firebase/CDN/APIs)
function isBypass(url) {
  return (
    url.startsWith("https://www.gstatic.com/") ||
    url.startsWith("https://unpkg.com/") ||
    url.startsWith("https://nominatim.openstreetmap.org/") ||
    url.startsWith("https://www.openstreetmap.org/") ||
    url.includes("tile.openstreetmap.org")
  );
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // ✅ بدل addAll (اللي بيفشل كله لو ملف واحد ناقص)
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

  // ✅ سيب أي CDN / API Network عادي
  if (isBypass(url)) return;

  // صفحات HTML: network-first
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: "no-store" });
        const copy = res.clone();
        const cache = await caches.open(CACHE);
        cache.put(req, copy);
        return res;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match("./index.html");
      }
    })());
    return;
  }

  // باقي الملفات: cache-first + تحديث عند أول تحميل
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      const copy = res.clone();
      const cache = await caches.open(CACHE);
      cache.put(req, copy);
      return res;
    } catch {
      return cached;
    }
  })());
});
