// messaging.js — Mashwarak (Toast + System Notifications + Sound/Vibrate) — v1
// ضع الملف بجانب: app.js / passenger.html / driver.html / login.html

let _toastEl = null;
let _icon = "./favicon.png";
let _appName = "مشوارك";
let _inited = false;

function _showToast(html, ms = 2600) {
  if (!_toastEl) return;
  _toastEl.innerHTML = html;
  _toastEl.classList.add("show");
  clearTimeout(_showToast._t);
  _showToast._t = setTimeout(() => {
    try { _toastEl.classList.remove("show"); } catch {}
  }, ms);
}

function _vibrate(pattern = [40, 40, 60]) {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {}
}

function _playTone(tone = "notify") {
  // نغمة بسيطة “احترافية” (Oscillators) — تعمل بدون ملفات صوت
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();

    const base =
      tone === "offer" ? 880 :
      tone === "accepted" ? 740 :
      tone === "arrived" ? 660 :
      tone === "started" ? 520 :
      tone === "ended" ? 420 : 600;

    const t0 = ctx.currentTime;

    o1.type = "sine";
    o2.type = "triangle";
    o1.frequency.setValueAtTime(base, t0);
    o2.frequency.setValueAtTime(base / 2, t0);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);

    o1.connect(g);
    o2.connect(g);
    g.connect(ctx.destination);

    o1.start(t0);
    o2.start(t0);

    o1.stop(t0 + 0.50);
    o2.stop(t0 + 0.50);

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
    new Notification(title, { body, icon: _icon, tag: tag || undefined });
  } catch {}
}

/**
 * initMessaging({
 *  appName, icon, toastId, askPermissionOnLoad
 * })
 */
export async function initMessaging(opts = {}) {
  _appName = opts.appName || _appName;
  _icon = opts.icon || _icon;

  if (opts.toastId) {
    _toastEl = document.getElementById(opts.toastId) || null;
  }

  _inited = true;

  if (opts.askPermissionOnLoad) {
    await ensureNotificationPermission().catch(() => {});
  }
}

/**
 * notify({
 *  title, body,
 *  tone: "notify"|"offer"|"accepted"|"arrived"|"started"|"ended",
 *  tag,
 *  toastHtml, toastMs,
 *  forceSystemWhenHidden: true/false (افتراضي true)
 * })
 */
export async function notify(payload = {}) {
  if (!_inited) await initMessaging({});

  const title = payload.title || _appName;
  const body = payload.body || "";
  const tone = payload.tone || "notify";
  const tag = payload.tag || ("mw_" + tone);

  // Toast (دايمًا)
  if (payload.toastHtml) _showToast(payload.toastHtml, payload.toastMs || 2600);

  // صوت + اهتزاز (دايمًا)
  _playTone(tone);
  _vibrate(
    tone === "offer" ? [60, 60, 90] :
    tone === "accepted" ? [40, 40, 60] :
    tone === "arrived" ? [70, 40, 70] :
    tone === "started" ? [40, 30, 40] :
    tone === "ended" ? [120] :
    [35, 30, 35]
  );

  // إشعار نظام: فقط لو الصفحة في الخلفية (أو مُجبَر)
  const force = payload.forceSystemWhenHidden !== false; // default true
  const canSystem = ("Notification" in window) && (Notification.permission === "granted");
  const hidden = (document.hidden || document.visibilityState === "hidden");
  const shouldSystem = force && hidden;

  if (canSystem && shouldSystem) {
    _systemNotify(title, body, tag);
  }
}
