// messaging.js — FINAL v1 (FCM Web + Firestore token save)
import { db } from "./app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ✅ حط الـ VAPID KEY بتاعك هنا من Firebase Console
const VAPID_KEY = "PASTE_VAPID_KEY_HERE";

let reg = null;

// ✅ صوت احترافي بسيط (اشتغل في المقدمة؛ الخلفية محتاجة notification + vibration)
let audioEl = null;
function playBeep(){
  try{
    if(!audioEl){
      audioEl = new Audio("./notify.mp3"); // لو مش موجود اعمل ملف mp3 صغير
      audioEl.volume = 0.9;
    }
    audioEl.currentTime = 0;
    audioEl.play().catch(()=>{});
  }catch{}
}

export async function initPushForUser({ uid, role }) {
  try{
    if(!("serviceWorker" in navigator)) return { ok:false, reason:"no-sw" };

    // ✅ لازم SW يكون متسجل علشان نستخدمه مع getToken
    reg = await navigator.serviceWorker.register("./sw.js?v=" + Date.now());

    // طلب إذن الإشعارات
    const perm = await Notification.requestPermission();
    if(perm !== "granted") return { ok:false, reason:"denied" };

    // ✅ Messaging
    const messaging = getMessaging();

    // ✅ getToken مع registration علشان ما نحتاجش firebase-messaging-sw.js منفصل
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if(!token) return { ok:false, reason:"no-token" };

    // ✅ خزّن token في users/{uid}
    // بنخزن tokens كـ map علشان تعدد الأجهزة
    const key = token.slice(0, 24); // مفتاح قصير
    await setDoc(doc(db, "users", uid), {
      fcmTokens: { [key]: token },
      pushEnabled: true,
      pushRole: role || null,
      updatedAt: serverTimestamp()
    }, { merge:true });

    // ✅ إشعارات داخل التطبيق وهو مفتوح (Foreground)
    onMessage(messaging, (payload)=>{
      const n = payload?.notification || {};
      const data = payload?.data || {};

      // صوت + إشعار UI داخل الصفحة (إنت هتربطه بتوست عندك)
      playBeep();

      // لو عايز: اعمل Notification حتى وهو فاتح
      try{
        new Notification(n.title || "مشوارك", {
          body: n.body || "تحديث جديد",
          icon: "./icon-192.png",
          data
        });
      }catch{}
    });

    return { ok:true, token };
  }catch(e){
    console.error(e);
    return { ok:false, reason: e?.message || "err" };
  }
}

// ✅ استقبال click message من SW لو المستخدم ضغط على الإشعار
export function listenPushClicks(handler){
  if(!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("message", (event)=>{
    const msg = event.data;
    if(msg?.type === "PUSH_CLICK"){
      handler?.(msg.data || {});
    }
  });
}
