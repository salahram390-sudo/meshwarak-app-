// app.js — FINAL v16 (Natural Register/Login + Multi-Role + Role Redirect) — Mashwarak
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDA9pP-Y3PEvl6675f4pHDyXzayzzmihhI",
  authDomain: "meshwark-8adf8.firebaseapp.com",
  projectId: "meshwark-8adf8",
  storageBucket: "meshwark-8adf8.appspot.com",
  messagingSenderId: "450060838946",
  appId: "1:450060838946:web:963cacdd125b253fa1827b",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ Persistent login
setPersistence(auth, browserLocalPersistence).catch(() => {});

// ========= URL helpers
export function qs(key) {
  try {
    const u = new URL(location.href);
    return u.searchParams.get(key);
  } catch {
    return null;
  }
}

// ✅ Active role per device
const LS_ACTIVE_ROLE = "mw_active_role";
export function setActiveRole(role) {
  if (role !== "passenger" && role !== "driver") return;
  try { localStorage.setItem(LS_ACTIVE_ROLE, role); } catch {}
}
export function getActiveRole() {
  try {
    const r = localStorage.getItem(LS_ACTIVE_ROLE);
    return (r === "passenger" || r === "driver") ? r : null;
  } catch {
    return null;
  }
}

// ========= Normalizers
export function normalizeEmail(input) {
  let x = String(input || "").trim().toLowerCase();
  if (!x) return null;

  // لو كتب اسم فقط -> بريد وهمي
  if (!x.includes("@")) {
    x = x.replace(/\s+/g, "").replace(/[^\w.-]/g, "");
    if (!x) x = "user";
    return `${x}@meshwarak.local`;
  }
  if (/^[^@]+@$/.test(x)) return x + "meshwarak.local";
  return x;
}

export function normalizePassword(input) {
  const x = String(input || "").trim();
  return x.length >= 6 ? x : null;
}

export function normalizePhone(input) {
  let x = String(input || "").trim();
  if (!x) return null;

  // أرقام عربية -> إنجليزية
  const map = { "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9" };
  x = x.replace(/[٠-٩]/g, (d) => map[d] ?? d);

  x = x.replace(/[^\d+]/g, "");
  if (x.includes("+")) x = "+" + x.replace(/\+/g, "");
  if (x.startsWith("00")) x = "+" + x.slice(2);

  // مصري
  if (/^01\d{9}$/.test(x)) x = "+20" + x;
  if (/^201\d{9}$/.test(x)) x = "+20" + x.slice(2);

  if (x.startsWith("+")) {
    const digits = x.slice(1);
    if (!/^\d{8,15}$/.test(digits)) return null;
    return "+" + digits;
  }

  if (!/^\d{8,15}$/.test(x)) return null;
  return x;
}

// ========= Firestore helpers
export async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function ensureUserDoc(uid, patch = {}) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      roles: patch.roles || { passenger: true },
      activeRole: patch.activeRole || "passenger",

      name: patch.name || null,
      phone: patch.phone || null,
      email: patch.email || null,
      governorate: patch.governorate || null,
      center: patch.center || null,
      currentRideId: null,

      vehicle: patch.vehicle || null,
      model: patch.model || null,
      plate: patch.plate || null,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return true;
  }
  return false;
}

export async function saveUserProfile(uid, payload) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
}

// ========= Natural Auth (Register / Login منفصلين)
export async function emailSignUp(emailRaw, passRaw) {
  const email = normalizeEmail(emailRaw);
  const password = normalizePassword(passRaw);
  if (!email) throw new Error("bad-email");
  if (!password) throw new Error("bad-pass");
  return await createUserWithEmailAndPassword(auth, email, password);
}

export async function emailSignIn(emailRaw, passRaw) {
  const email = normalizeEmail(emailRaw);
  const password = normalizePassword(passRaw);
  if (!email) throw new Error("bad-email");
  if (!password) throw new Error("bad-pass");
  return await signInWithEmailAndPassword(auth, email, password);
}

// ✅ Compatibility (لو login.html القديم بيستدعي emailLoginOrSignup)
// - ده بيحاول Login الأول، لو المستخدم مش موجود يعمل Signup.
// - لو انت عامل صفحة فيها زر "تسجيل" وزر "دخول" منفصلين: استخدم emailSignUp / emailSignIn بدل ده.
export async function emailLoginOrSignup(emailRaw, passRaw) {
  try {
    return await emailSignIn(emailRaw, passRaw);
  } catch (e) {
    const code = e?.code || "";
    if (code === "auth/user-not-found") {
      return await emailSignUp(emailRaw, passRaw);
    }
    throw e;
  }
}

// ========= Guard (حماية الصفحات حسب الدور)
export async function requireAuthAndRole(requiredRole = null) {
  const user = await new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => { unsub(); resolve(u); },
      (e) => { unsub(); reject(e); }
    );
  });

  const wanted = (qs("role") === "driver") ? "driver" : ((qs("role") === "passenger") ? "passenger" : null);

  if (!user) {
    // لو داخل صفحة role مباشرة، رجّعه login بنفس role
    const r = wanted ? `?role=${wanted}` : "";
    location.href = "./login.html" + r;
    throw new Error("not signed in");
  }

  let data = await getUserDoc(user.uid).catch(() => null);
  if (!data) {
    await ensureUserDoc(user.uid, {
      roles: { passenger: true },
      activeRole: "passenger",
      email: user.email || null,
    });
    data = await getUserDoc(user.uid).catch(() => null);
  }

  // ✅ activeRole = localStorage أولاً، وبعدها Firestore
  let activeRole = getActiveRole() || data?.activeRole || null;

  // ✅ لو في ?role=... نخليه هو الـ activeRole على الجهاز
  if (wanted && (wanted === "passenger" || wanted === "driver")) {
    activeRole = wanted;
    setActiveRole(wanted);
  }

  // ✅ لو الصفحة بتطلب دور معين
  if (requiredRole && activeRole !== requiredRole) {
    // ارجع للصفحة الرئيسية بدل ما تفضل تلف
    location.href = "./index.html";
    throw new Error("wrong role");
  }

  return { user, data, activeRole };
}

export async function doLogout() {
  try { await signOut(auth); } catch {}
  try { localStorage.removeItem(LS_ACTIVE_ROLE); } catch {}
  location.href = "./login.html";
}
