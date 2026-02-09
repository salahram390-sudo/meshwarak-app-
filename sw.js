/* sw.js - Meshwarak PWA (GitHub Pages friendly) ✅ */
const VERSION = "meshwarak-v4";          // ✅ تم تغييره
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE  = `${VERSION}-pages`;

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
  "./icon-512.png",
];

// ===== Install: precache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ===== Activate: delete old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Helpers
function isHTML(req) {
  return req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
}
function isGET(req) {
  return req.method === "GET";
}

// ===== Strategies
async function networkFirst(req) {
  const cache = await caches.open(PAGES_CACHE);

  try {
    const fresh = await fetch(req);
    // Cache only OK responses
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (e) {
    const cached = await cache.match(req);
    return cached || caches.match("./index.html");
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);

  // رجّع cached بسرعة، وفي الخلفية حدّث
  return cached || (await fetchPromise) || cached;
}

// ===== Fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // SW يعالج GET فقط
  if (!isGET(req)) return;

  // صفحات HTML: network-first
  if (isHTML(req)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // باقي الملفات: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req));
});
