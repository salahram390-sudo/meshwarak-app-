// messaging.js (FINAL SAFE v1)
// Unified notifications: Toast + Sound/Vibrate + System Notification (when hidden)

const DEFAULT_TONES = {
  notify:   { freq: 600,  dur: 0.58, vib: [80] },
  offer:    { freq: 880,  dur: 0.60, vib: [120, 80, 120] },
  accepted: { freq: 740,  dur: 0.60, vib: [90, 60, 90] },
  arrived:  { freq: 660,  dur: 0.60, vib: [60, 40, 60, 40, 80] },
  started:  { freq: 520,  dur: 0.60, vib: [140] },
  ended:    { freq: 420,  dur: 0.60, vib: [220] },
};

let _ctx = null;
let _toastEl = null;
let _appName = "مشوارك";
let _icon = "./favicon.png";

/**
 * initMessaging({
 *   appName, icon,
 *   toastId,
 *   askPermissionOnLoad
 * })
 */
export async function initMessaging(opts = {}) {
  _appName = opts.appName || _appName;
  _icon = opts.icon || _icon;

  if (opts.toastId) {
    _toastEl = document.getElementById(opts.toastId) || null;
  }

  // تجهيز أذونات الإشعارات (اختياري)
  if (opts.askPermissionOnLoad) {
    try { await ensureNotificationPermission(); } catch {}
  }

  // محاولة تجهيز AudioContext عند أول تفاعل (لمنع block على الموبايل)
  const warmup = () => {
    try {
      _ctx = _ctx || new (window.AudioContext || window.webkitAudioContext)();
      // لا نشغل صوت فعلي هنا، بس نضمن جاهزية الكونتكست
    } catch {}
    window.removeEventListener("pointerdown", warmup);
    window.removeEventListener("touchstart", warmup);
  };
  window.addEventListener("pointerdown", warmup, { once: true });
  window.addEventListener("touchstart", warmup, { once: true });
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

function showToast(html, ms = 2600) {
  try {
    if (!_toastEl) return;
    _toastEl.innerHTML = html;
    _toastEl.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => _toastEl?.classList.remove("show"), ms);
  } catch {}
}

function vibrate(pattern) {
  try {
    if (!("vibrate" in navigator)) return;
    navigator.vibrate(pattern);
  } catch {}
}

function playBeepTone(tone = "notify") {
  try {
    const cfg = DEFAULT_TONES[tone] || DEFAULT_TONES.notify;
    _ctx = _ctx || new (window.AudioContext || window.webkitAudioContext)();

    const o = _ctx.createOscillator();
    const g = _ctx.createGain();
    o.type = "sine";

    const now = _ctx.currentTime;
    o.frequency.setValueAtTime(cfg.freq, now);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (cfg.dur || 0.55));

    o.connect(g);
    g.connect(_ctx.destination);

    o.start(now);
    o.stop(now + (cfg.dur || 0.55));
  } catch {}
}

function notifySystem(title, body, tag) {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    // بعض الأجهزة بتحتاج https + PWA
    new Notification(title, {
      body,
      icon: _icon,
      tag: tag || undefined,
    });
  } catch {}
}

/**
 * notify({
 *   title, body,
 *   tone: "offer|accepted|arrived|started|ended|notify",
 *   tag: "string",
 *   toastHtml: "html",
 *   toastMs: number,
 *   forceSystemWhenHidden: boolean (default true)
 * })
 */
export async function notify(opts = {}) {
  const title = opts.title || _appName;
  const body = opts.body || "";
  const tone = opts.tone || "notify";
  const tag = opts.tag || "";

  // Toast
  if (opts.toastHtml) showToast(opts.toastHtml, opts.toastMs || 2600);

  // Sound + Vibration
  playBeepTone(tone);
  const cfg = DEFAULT_TONES[tone] || DEFAULT_TONES.notify;
  vibrate(cfg.vib);

  // System Notification (يفضل فقط لما الصفحة تكون مخفية)
  const force = (opts.forceSystemWhenHidden !== undefined) ? opts.forceSystemWhenHidden : true;
  const isHidden = typeof document !== "undefined" ? document.hidden : false;

  if (force && isHidden) {
    try { await ensureNotificationPermission(); } catch {}
    notifySystem(title, body, tag);
  }
}
