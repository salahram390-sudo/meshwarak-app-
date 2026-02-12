// app.js — FINAL (GitHub Pages + Firebase v10.12.5) ✅
// ✅ يصلّح الخطأ: "does not provide an export named emailSignIn"
// ✅ يثبت الدور (راكب/سائق) ويمنع اختفاء خانات السائق
// ✅ دوال موحّدة تستخدمها كل الصفحات بدون كسر

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   ✅ Firebase Config (ثابت)
   ========================= */
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

/* =========================
   ✅ Helpers
   ========================= */
export function qs(key) {
  try {
    return new URL(location.href).searchParams.get(key);
  } catch {
    return null;
  }
}

function clean(s) {
  return (s || "").trim().replace(/\s+/g, " ");
}

/* =========================
   ✅ Role (localStorage)
   ========================= */
const LS_ROLE = "mw_active_role"; // passenger | driver

export function setActiveRole(role) {
  const r = role === "driver" ? "driver" : "passenger";
  try { localStorage.setItem(LS_ROLE, r); } catch {}
  return r;
}

export function getActiveRole() {
  try {
    const r = localStorage.getItem(LS_ROLE);
    return r === "driver" ? "driver" : "passenger";
  } catch {
    return "passenger";
  }
}

/* =========================
   ✅ Auth wrappers
   ========================= */
export async function emailSignUp(email, password) {
  const e = clean(email);
  const p = String(password || "");
  return await createUserWithEmailAndPassword(auth, e, p);
}

export async function emailSignIn(email, password) {
  const e = clean(email);
  const p = String(password || "");
  return await signInWithEmailAndPassword(auth, e, p);
}

/* =========================
   ✅ Firestore user helpers
   ========================= */
export async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function ensureUserDoc(uid, defaults = {}) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const base = {
      roles: { passenger: true, driver: true },
      activeRole: getActiveRole(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...defaults,
    };
    await setDoc(ref, base, { merge: true });
    return base;
  }

  // ✅ لو موجود: نضمن roles و activeRole دائمًا
  const cur = snap.data() || {};
  const merged = {
    roles: { passenger: true, driver: true, ...(cur.roles || {}) },
    activeRole: cur.activeRole || getActiveRole(),
    updatedAt: serverTimestamp(),
    ...defaults,
  };

  await setDoc(ref, merged, { merge: true });
  return { ...cur, ...merged };
}

export async function saveUserProfile(uid, payload = {}) {
  const ref = doc(db, "users", uid);

  const safe = { ...payload };

  // ✅ تأكد roles/activeRole موجودين
  safe.roles = safe.roles || { passenger: true, driver: true };
  safe.activeRole = safe.activeRole || getActiveRole();

  // ✅ تواريخ
  safe.updatedAt = serverTimestamp();

  await setDoc(ref, safe, { merge: true });
  return true;
}

/* =========================
   ✅ Guard: require auth + role
   ========================= */
export async function requireAuthAndRole(requiredRole = null) {
  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u || null);
    });
  });

  if (!user) {
    // لو مش عامل دخول
    location.href = "./login.html?role=" + (requiredRole === "driver" ? "driver" : "passenger");
    throw new Error("not-authenticated");
  }

  // ✅ اضمن user doc
  const data = await ensureUserDoc(user.uid, {
    email: user.email || null,
  }).catch(async () => {
    // fallback: لو ensure فشل
    const u = await getUserDoc(user.uid).catch(() => null);
    return u || { roles: { passenger: true, driver: true }, activeRole: getActiveRole() };
  });

  // ✅ حدّث الدور النشط من الرابط لو موجود
  const qRole = qs("role");
  if (qRole === "driver" || qRole === "passenger") setActiveRole(qRole);

  // ✅ تحديد الدور الحالي
  const active = getActiveRole();
  const roleOk = !requiredRole || requiredRole === active;

  // ✅ لو الصفحة تتطلب دور معين وهو داخل بدور تاني → حوله للّوجن بنفس الدور المطلوب
  if (!roleOk) {
    setActiveRole(requiredRole);
    location.href = "./login.html?role=" + requiredRole;
    throw new Error("wrong-role");
  }

  return { user, data: { ...data, role: active } };
}

/* =========================
   ✅ Logout
   ========================= */
export async function doLogout() {
  try { await signOut(auth); } catch {}
  try { localStorage.removeItem("currentTripId"); } catch {}
  location.href = "./index.html";
}
