// messaging.js — Mashwarak (Notifications + Sound + Vibration) v1
// ✅ ملف جديد: حطه جنب app.js (نفس الفولدر) باسم: messaging.js

let _inited = false;
let _role = "app";
let _appName = "مشوارك";
let _icon = "./favicon.png";
let _toastEl = null;

function $(id){ return document.getElementById(id); }

// ===== Toast (اختياري)
function bindToast(toastId){
  _toastEl = toastId ? $(toastId) : null;
}

export function showToast(html, ms=2600){
  if(!_toastEl) return;
  _toastEl.innerHTML = html;
  _toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>_toastEl.classList.remove("show"), ms);
}

// ===== Sound (WebAudio)
export function beep(type="notify"){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return;

    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    const now = ctx.currentTime;

    // نغمات مختلفة حسب الحدث
    const freq =
      type==="new_ride" ? 980 :
      type==="offer" ? 880 :
      type==="accepted" ? 740 :
      type==="arrived" ? 660 :
      type==="started" ? 520 :
      type==="ended" ? 420 :
      600;

    o.type = "sine";
    o.frequency.setValueAtTime(freq, now);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.20, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.60);

    o.connect(g);
    g.connect(ctx.destination);

    o.start(now);
    o.stop(now + 0.62);

    setTimeout(()=>{ try{ ctx.close(); }catch{} }, 800);
  }catch{}
}

// ===== Vibration (Android)
export function vibrate(pattern=[80,40,80]){
  try{
    if("vibrate" in navigator) navigator.vibrate(pattern);
  }catch{}
}

// ===== Permissions
export async function ensureNotificationPermission(){
  try{
    if(!("Notification" in window)) return false;
    if(Notification.permission === "granted") return true;
    if(Notification.permission === "denied") return false;
    const p = await Notification.requestPermission();
    return p === "granted";
  }catch{
    return false;
  }
}

// ===== System notification (أفضل استخدام SW لو موجود)
async function systemNotify(title, body, tag){
  try{
    if(!("Notification" in window)) return;
    if(Notification.permission !== "granted") return;

    // لو Service Worker شغال: استخدم showNotification (أفضل حتى لو الشاشة مقفولة داخل PWA)
    if("serviceWorker" in navigator){
      const reg = await navigator.serviceWorker.getRegistration();
      if(reg && reg.showNotification){
        await reg.showNotification(title, {
          body,
          icon: _icon,
          badge: _icon,
          tag: tag || undefined,
          renotify: !!tag,
          requireInteraction: false,
          silent: true // الصوت من عندنا (beep) علشان يبقى ثابت
        });
        return;
      }
    }

    // fallback عادي
    new Notification(title, { body, icon:_icon, tag: tag || undefined });
  }catch{}
}

// ===== Main notify helper
export async function notify({
  title,
  body,
  tone="notify",     // notify | offer | accepted | arrived | started | ended | new_ride
  tag=null,
  toastHtml=null,
  toastMs=3000,
  withSound=true,
  withVibrate=true,
  forceSystemWhenHidden=true,
}={}){
  const t = title || _appName;
  const b = body || "";

  // Toast داخل الصفحة
  if(toastHtml && _toastEl){
    showToast(toastHtml, toastMs);
  }

  // صوت + اهتزاز
  if(withSound) beep(tone);
  if(withVibrate) vibrate();

  // إشعار نظام لو الصفحة مش ظاهرة أو لو طلبت
  const hidden = document.hidden || document.visibilityState !== "visible";
  if(forceSystemWhenHidden && hidden){
    await systemNotify(t, b, tag || tone);
  }
}

// ===== Init
export async function initMessaging({
  role="app",
  appName="مشوارك",
  icon="./favicon.png",
  toastId="toast",          // لو عندك عنصر Toast بنفس id
  askPermissionOnLoad=true, // يطلب الإذن أول مرة
}={}){
  _role = role;
  _appName = appName;
  _icon = icon;

  bindToast(toastId);

  if(_inited) return;
  _inited = true;

  // حاول تجهز permission بدري (اختياري)
  if(askPermissionOnLoad){
    ensureNotificationPermission().catch(()=>{});
  }

  // لو المستخدم لمس أي مكان: نضمن إن الصوت شغال على iOS/Android
  const unlock = ()=>{
    try{
      // تشغيل beep صغيرة جدًا لفتح الصوت (بدون إزعاج)
      beep("notify");
    }catch{}
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once:true });
  window.addEventListener("touchstart", unlock, { once:true });
}
