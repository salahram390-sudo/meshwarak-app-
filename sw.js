// sw.js (FINAL SAFE v11 - GitHub Pages Fix)
// ✅ غيّر الرقم عند أي تحديث كبير لتفريغ كاش الأجهزة القديمة
const CACHE = "meshwarak-v11";

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

function isHtml(req) {
  return req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
}
function isCodeAsset(url) {
  return url.endsWith(".js") || url.endsWith(".css") || url.endsWith(".html");
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // ✅ كاش آمن: نخزن بنفس الـ Request الفعلي عشان caches.match(req) يشتغل
    await Promise.all(
      ASSETS.map(async (path) => {
        try {
          const req = new Request(path, { cache: "reload" });
          const res = await fetch(req);
          if (res.ok) await cache.put(req, res.clone());
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

  // ✅ سيب أي حاجة خارجية Network طبيعي
  if (isBypass(url)) return;

  // ✅ HTML / JS / CSS: Network-first (عشان التحديثات توصل فوراً)
  if (isHtml(req) || isCodeAsset(new URL(url).pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);

      try {
        const res = await fetch(req, { cache: "no-store" });
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        // fallback للكاش
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;

        // fallback إضافي للصفحات
        if (isHtml(req)) {
          const home = await cache.match(new Request("./index.html", { cache: "reload" }), { ignoreSearch: true });
          if (home) return home;
        }

        throw new Error("offline");
      }
    })());
    return;
  }

  // ✅ باقي الملفات (صور/manifest..): Cache-first + تحديث خلفي
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });

    const networkFetch = fetch(req)
      .then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })
      .catch(() => null);

    if (cached) {
      e.waitUntil(networkFetch);
      return cached;
    }

    const res = await networkFetch;
    return res || cached;
  })());
});
