// sw.js (FINAL - SAFE)
const CACHE = "meshwarak-v4"; // ✅ غيّر الرقم عند كل تحديث

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
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // ✅ لو ملف ناقص: ما تفشلش التثبيت (بدون شاشة بيضا)
    await Promise.allSettled(
      ASSETS.map((u) =>
        cache.add(new Request(u, { cache: "reload" }))
      )
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
  const url = new URL(req.url);

  // ✅ تجاهل أي طلبات مش http(s)
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html") ||
    url.pathname.endsWith(".html");

  // ✅ HTML: Network-first (علشان ما يعلقش على نسخة قديمة)
  if (isHTML) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match("./index.html");
      }
    })());
    return;
  }

  // ✅ باقي الملفات: Cache-first + تحديث بالخلفية
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      e.waitUntil((async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        } catch {}
      })());
      return cached;
    }

    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    } catch {
      return new Response("", { status: 504, statusText: "offline" });
    }
  })());
});
