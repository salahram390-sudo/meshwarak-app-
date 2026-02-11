// sw.js — FINAL v13 (Cache + Push Notifications FCM)
// ✅ غيّر الرقم عند أي تحديث كبير لتفريغ كاش الأجهزة القديمة
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

// =======================
// ✅ INSTALL / ACTIVATE
// =======================
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);

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

// =======================
// ✅ FETCH (نفس منطقك)
// =======================
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = req.url;

  if (isBypass(url)) return;

  const pathname = new URL(url).pathname;

  // HTML/JS/CSS: Network-first
  if (isHtml(req) || isCodeAsset(pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: "no-store" });
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;

        if (isHtml(req)) {
          const home = await cache.match(new Request("./index.html", { cache: "reload" }), { ignoreSearch: true });
          if (home) return home;
        }
        throw new Error("offline");
      }
    })());
    return;
  }

  // باقي الملفات: Cache-first + تحديث خلفي
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

// =======================
// ✅ PUSH NOTIFICATIONS (FCM Compatible)
// =======================
// FCM Web Push غالبًا بييجي event.data.json() بالشكل ده:
// { notification:{title, body, image}, data:{ url, role, rideId, type } }
// أو ممكن ييجي { title, body, ... } حسب الإرسال من السيرفر
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch {
      try { payload = { body: event.data.text() }; } catch { payload = {}; }
    }

    const n = payload.notification || payload || {};
    const data = payload.data || n.data || payload.data || {};

    const title = n.title || "مشوارك";
    const body  = n.body  || "لديك تحديث جديد";
    const icon  = "./icon-192.png";
    const badge = "./icon-192.png";

    // ✅ لينك فتح التطبيق عند الضغط
    // لو data.url مش موجودة: هنفتح index
    const url =
      data.url ||
      (data.role === "driver" ? "./driver.html" :
       data.role === "passenger" ? "./passenger.html" :
       "./index.html");

    const options = {
      body,
      icon,
      badge,
      data: { url, ...data },
      vibrate: [120, 80, 120],
      tag: data.tag || data.rideId || data.type || "meshwarak",
      renotify: true,
      requireInteraction: false, // خليها true لو عايز الإشعار يفضل ظاهر لحد ما المستخدم يقفله
      // actions اختيارية (مش كل الأجهزة بتظهرها)
      actions: [
        { action: "open", title: "فتح" },
        { action: "dismiss", title: "إغلاق" }
      ]
    };

    await self.registration.showNotification(title, options);
  })());
});

// فتح الصفحة المناسبة عند الضغط على الإشعار
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || "./index.html";

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

    // لو نافذة مفتوحة بالفعل: ركّز عليها
    for (const c of allClients) {
      try {
        const u = new URL(c.url);
        const t = new URL(targetUrl, self.location.origin);

        // نفس الصفحة (بدون query) -> focus
        if (u.pathname === t.pathname) {
          await c.focus();
          // ابعت رسالة للصفحة علشان تعمل Navigation داخلي/فتح رحلة
          c.postMessage({ type: "PUSH_CLICK", data });
          return;
        }
      } catch {}
    }

    // مفيش نافذة: افتح جديد
    const opened = await clients.openWindow(targetUrl);
    // لو اتفتحت: ابعت نفس الرسالة
    if (opened) {
      try { opened.postMessage({ type: "PUSH_CLICK", data }); } catch {}
    }
  })());
});
