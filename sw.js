// sw.js (FINAL SAFE v10 - stale-while-revalidate)
// مهم: غيّر الرقم عند أي تحديث كبير (لتفريغ كاش الأجهزة القديمة)
const CACHE = "meshwarak-v10";

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

// ملفات خارجية ما نكاشّهاش (Firebase/CDN/APIs/Maps)
function isBypass(url) {
  return (
    url.startsWith("https://www.gstatic.com/") ||
    url.startsWith("https://unpkg.com/") ||
    url.startsWith("https://cdn.jsdelivr.net/") ||
    url.includes("openstreetmap.org") ||
    url.includes("tile.openstreetmap.org") ||
    url.includes("nominatim.openstreetmap.org")
  );
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // بدل addAll (اللي بيفشل كله لو ملف واحد ناقص)
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

  if (isBypass(url)) return; // Network فقط

  // صفحات HTML: Network-first + fallback
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
        return res;
      } catch {
        return (await caches.match(req)) || (await caches.match("./index.html"));
      }
    })());
    return;
  }

  // باقي الملفات: Stale-While-Revalidate
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);

    const networkFetch = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    // لو عندنا cached رجّعه فوراً، وفي الخلفية حدّثه من الشبكة
    if (cached) {
      e.waitUntil(networkFetch);
      return cached;
    }

    // لو مفيش cached حاول من الشبكة
    const res = await networkFetch;
    return res || cached;
  })());
});
