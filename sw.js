// sw.js — FINAL v14 (GitHub Pages Safe + Cache Safe) ✅
// هدفه: يمنع الكاش من تكسير التحديثات/الأزرار + يخلي التحديثات توصل فوراً
// ملاحظة: بدون Firebase/FCM داخل SW لتفادي فشل التسجيل على GitHub Pages

const CACHE = "meshwarak-v14";

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
  "./messaging.js",
  "./manifest.json",
  "./favicon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png"
];

function isBypass(url) {
  // أي شيء خارجي ما نلمسوش
  return (
    url.startsWith("https://www.gstatic.com/") ||
    url.startsWith("https://unpkg.com/") ||
    url.startsWith("https://cdn.jsdelivr.net/") ||
    url.includes("openstreetmap.org") ||
    url.includes("tile.openstreetmap.org") ||
    url.includes("nominatim.openstreetmap.org") ||
    url.includes("router.project-osrm.org") ||
    url.includes("google.com/maps") ||
    url.includes("maps.google.com")
  );
}

function isHtml(req) {
  return req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
}

function isCodeAsset(pathname) {
  return pathname.endsWith(".js") || pathname.endsWith(".css") || pathname.endsWith(".html");
}

// ===== install
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // كاش آمن: نحفظ نفس الـ Request الحقيقي
    await Promise.all(
      ASSETS.map(async (path) => {
        try {
          const req = new Request(path, { cache: "reload" });
          const res = await fetch(req);
          if (res && res.ok) await cache.put(req, res.clone());
        } catch {}
      })
    );

    await self.skipWaiting();
  })());
});

// ===== activate
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// ===== fetch
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = req.url;

  if (isBypass(url)) return;

  let pathname = "";
  try { pathname = new URL(url).pathname; } catch {}

  // ✅ HTML/JS/CSS = Network-first (التحديثات لازم توصل فورًا)
  if (isHtml(req) || isCodeAsset(pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: "no-store" });
        if (res && res.ok) await cache.put(req, res.clone());
        return res;
      } catch {
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;

        // fallback للصفحات
        if (isHtml(req)) {
          const homeReq = new Request("./index.html", { cache: "reload" });
          const home = await cache.match(homeReq, { ignoreSearch: true });
          if (home) return home;
        }
        throw new Error("offline");
      }
    })());
    return;
  }

  // ✅ باقي الملفات: Cache-first + تحديث خلفي
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });

    const networkFetch = fetch(req)
      .then(async (res) => {
        if (res && res.ok) await cache.put(req, res.clone());
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

// ✅ لو حد ضغط على إشعار (لو المتصفح عمل Notification عادي)
// يفتح الصفحة الرئيسية
self.addEventListener("notificationclick", (event) => {
  event.notification?.close?.();
  event.waitUntil((async () => {
    const targetUrl = "./index.html";
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of allClients) {
      try {
        await c.focus();
        return;
      } catch {}
    }
    await clients.openWindow(targetUrl);
  })());
});
