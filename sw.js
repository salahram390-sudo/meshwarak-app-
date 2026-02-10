// sw.js (جاهز — FIXED)
const CACHE = "meshwarak-v4"; // ✅ غيّر الرقم عند كل تحديث كبير

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

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      // ✅ لا تخلّي install يفشل لو ملف واحد مش موجود (زي profile.html / trip.html)
      await Promise.all(
        ASSETS.map((url) =>
          fetch(url, { cache: "no-store" })
            .then((res) => (res.ok ? c.put(url, res.clone()) : null))
            .catch(() => null)
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// ✅ Network-first للـ HTML (عشان التحديثات توصل فوراً)
// ✅ Cache-first لباقي الملفات (مع تحديث الخلفية)
self.addEventListener("fetch", (e) => {
  const req = e.request;

  const isHtml =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHtml) {
    e.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || (await caches.match("./index.html")) || Response.error();
        })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => null);

      // Cache-first
      if (cached) {
        // تحديث بالخلفية
        e.waitUntil(networkFetch);
        return cached;
      }

      // لو مفيش كاش
      return networkFetch.then((r) => r || Response.error());
    })
  );
});
