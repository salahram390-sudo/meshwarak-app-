// messaging.js — FINAL (Toast + System Notification + Sound + Vibrate)
// ✅ يعمل على الموبايل + PWA + بدون أخطاء حتى لو Notification غير مدعوم

let _cfg = {
  appName: "مشوارك",
  icon: "./icon-192.png",
  toastId: "toast",
  askPermissionOnLoad: false,
};

let _toastEl = null;

function _getToastEl() {
  if (_toastEl) return _toastEl;
  _toastEl = document.getElementById(_cfg.toastId) || null;
  return _toastEl;
}

function _showToast(html, ms = 2600) {
  const el = _getToastEl();
  if (!el) return;

  el.innerHTML = html;
  el.classList.add("show");

  clearTimeout(_showToast._t);
  _showToast._t = setTimeout(() => {
    try { el.classList.remove("show"); } catch {}
  }, ms);
}

function _vibrate(pattern = [80, 40, 80]) {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {}
}

function _beep(tone = "notify") {
  // لو المتصفح مانع الصوت: مفيش مشكلة
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = "sine";
    const now = ctx.currentTime;

    const freq =
      tone === "offer" ? 880 :
      tone === "accepted" ? 740 :
      tone === "arrived" ? 660 :
      tone === "started" ? 520 :
      tone === "ended" ? 420 : 600;

    o.frequency.setValueAtTime(freq, now);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    o.connect(g);
    g.connect(ctx.destination);

    o.start(now);
    o.stop(now + 0.58);

    setTimeout(() => { try { ctx.close(); } catch {} }, 700);
  } catch {}
}

export async function ensureNotificationPermission() {
  try {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const p = await Notification.requestPermission();
    return p === "granted";
  } catch {
    return false;
  }
}

function _systemNotify(title, body, tag) {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    new Notification(title, {
      body,
      icon: _cfg.icon,
      tag: tag || undefined,
      silent: true
    });
  } catch {}
}

export async function initMessaging(opts = {}) {
  _cfg = { ..._cfg, ...opts };
  _toastEl = null;

  if (_cfg.askPermissionOnLoad) {
    await ensureNotificationPermission();
  }
}

/**
 * notify({
 *  title, body,
 *  tone: notify|offer|accepted|arrived|started|ended
 *  tag,
 *  toastHtml, toastMs,
 *  forceSystemWhenHidden
 * })
 */
export async function notify({
  title,
  body,
  tone = "notify",
  tag = "",
  toastHtml = "",
  toastMs = 2600,
  forceSystemWhenHidden = true,
} = {}) {
  const t = title || _cfg.appName;
  const b = body || "";

  // Toast
  if (toastHtml) _showToast(toastHtml, toastMs);

  // Sound + vibrate
  _beep(tone);
  if (tone !== "notify") _vibrate([90, 40, 90]);
  else _vibrate([40]);

  // System Notification
  const hidden = document.hidden || document.visibilityState !== "visible";
  if (forceSystemWhenHidden && hidden) {
    await ensureNotificationPermission();
    _systemNotify(t, b, tag);
  }
}
