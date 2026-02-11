// sw.js — FINAL v13 (Cache + FCM Background Push) ✅ جاهز للنسخ واللصق
// ✅ GitHub Pages safe + Cache safe + Firebase compat + Notification click open
const CACHE = "meshwarak-v13";

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
  "./icon-192.png",
  "./icon-512.png"
];

// ========= Firebase Messaging (Compat in SW)
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDA9pP-Y3PEvl6675f4pHDyXzayzzmihhI",
  authDomain: "meshwark-8adf8.firebaseapp.com",
  projectId: "meshwark-8adf8",
  storageBucket: "meshwark-8adf8.appspot.com",
  messagingSenderId: "450060838946",
  appId: "1:450060838946:web:963cacdd125b253fa1827b",
});

let messaging = null;
try { messaging = firebase.messaging(); } catch {}

function isBypass(url) {
  return (
    url.startsWith("https://www.gstatic.com/") ||
    url.startsWith("https://unpkg.com/") ||
    url.startsWith("https://cdn.jsdelivr.net/") ||
    url.includes("openstreetmap.org") ||
    url.includes("tile.openstreetmap.org") ||
    url.includes("nominatim.openstreetmap.org") ||
    url.includes("router.project-osrm.org")
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

    // ✅ كاش آمن: نحفظ بنفس الـ Request الحقيقي
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

  // ✅ سيب الخارجي Network طبيعي
  if (isBypass(url)) return;

  let pathname = "";
  try { pathname = new URL(url).pathname; } catch {}

  // ✅ HTML/JS/CSS: Network-first (علشان التحديثات توصل فورًا)
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

// =======================
// ✅ FCM Background handler
// =======================
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const n = payload?.notification || {};
    const data = payload?.data || {};

    const title = n.title || "مشوارك";
    const body  = n.body  || "لديك تحديث جديد";
    const icon  = "./icon-192.png";
    const badge = "./icon-192.png";

    const url =
      data.url ||
      (data.role === "driver" ? "./driver.html" :
       data.role === "passenger" ? "./passenger.html" :
       "./index.html");

    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url, ...data },
      vibrate: [120, 80, 120],
      tag: data.tag || data.rideId || data.type || "meshwarak",
      renotify: true,
      actions: [
        { action: "open", title: "فتح" },
        { action: "dismiss", title: "إغلاق" }
      ]
    });
  });
}

// ✅ فتح الصفحة المناسبة عند الضغط على الإشعار
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || "./index.html";

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

    // لو في تبويب مفتوح لنفس الصفحة
    for (const c of allClients) {
      try {
        const u = new URL(c.url);
        const t = new URL(targetUrl, self.location.origin);
        if (u.pathname === t.pathname) {
          await c.focus();
          try { c.postMessage({ type: "PUSH_CLICK", data }); } catch {}
          return;
        }
      } catch {}
    }

    // افتح جديد
    const opened = await clients.openWindow(targetUrl);
    if (opened) {
      try { opened.postMessage({ type: "PUSH_CLICK", data }); } catch {}
    }
  })());
});
```0
