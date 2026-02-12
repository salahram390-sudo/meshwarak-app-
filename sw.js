// sw.js — FINAL v15 ✅ (NO CACHE at all + FCM Background Push)
// الهدف: إنهاء مشاكل الكاش/التحديث نهائيًا على GitHub Pages
// - لا يوجد install caching
// - لا يوجد fetch handler (كل شيء Network)
// - يحتفظ بـ FCM background + notification click

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

// ✅ install/activate: فقط تفعيل سريع بدون كاش
self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
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

    const opened = await clients.openWindow(targetUrl);
    if (opened) {
      try { opened.postMessage({ type: "PUSH_CLICK", data }); } catch {}
    }
  })());
});
