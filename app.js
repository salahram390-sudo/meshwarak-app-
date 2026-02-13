// app.js — FINAL (stable exports for all pages) ✅
// GitHub Pages + Firebase v10 modular CDN

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ===== Firebase Config (زي ما عندك)
export const firebaseConfig = {
  apiKey: "AIzaSyDA9pP-Y3PEvl6675f4pHDyXzayzzmihhI",
  authDomain: "meshwark-8adf8.firebaseapp.com",
  projectId: "meshwark-8adf8",
  storageBucket: "meshwark-8adf8.appspot.com",
  messagingSenderId: "450060838946",
  appId: "1:450060838946:web:963cacdd125b253fa1827b",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ مهم جدًا علشان الجلسة تفضل محفوظة
try {
  await setPersistence(auth, browserLocalPersistence);
} catch {}

// ===== أدوات عامة
export function qs(name) {
  try {
    return new URL(location.href).searchParams.get(name);
  } catch {
    return null;
  }
}

export const ROLE_KEY = "activeRole";

export function setActiveRole(role) {
  const r = role === "driver" ? "driver" : "passenger";
  localStorage.setItem(ROLE_KEY, r);
  return r;
}

export function getActiveRole() {
  const r = localStorage.getItem(ROLE_KEY);
  return r === "driver" || r === "passenger" ? r : "passenger";
}

// ===== Utils
const clean = (s) => (s || "").toString().trim().replace(/\s+/g, " ");
const cleanPhone = (p) => {
  const x = clean(p);
  if (!x) return null;
  // رقم مصري بسيط (مش validation قوي) — بس يمنع الفراغات
  return x.replace(/[^\d+]/g, "");
};

export function userRef(uid) {
  return doc(db, "users", uid);
}

// ===== Firestore helpers
export async function getUserDoc(uid) {
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * ensureUserDoc:
 * - ينشئ doc لو مش موجود
 * - لو موجود: يحدّث patch فقط بدون ما "يمسح" roles أو بيانات قديمة
 */
export async function ensureUserDoc(uid, patch = {}) {
  const ref = userRef(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const base = {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      roles: { passenger: true, driver: true },
      activeRole: getActiveRole(),
      phone: null,
      address: null,
      name: null,
      ...patch,
    };
    await setDoc(ref, base, { merge: true });
    return { ...base, ...patch };
  }

  const existing = snap.data() || {};

  // ✅ roles: دمج بدل overwrite
  const rolesMerged = {
    passenger: true,
    driver: true,
    ...(existing.roles || {}),
    ...(patch.roles || {}),
  };

  // ✅ تنظيف phone/address لو موجودين في patch
  const nextPatch = { ...patch };
  if ("phone" in nextPatch) nextPatch.phone = cleanPhone(nextPatch.phone);
  if ("address" in nextPatch) nextPatch.address = clean(nextPatch.address) || null;
  if ("name" in nextPatch) nextPatch.name = clean(nextPatch.name) || null;

  const merged = {
    ...nextPatch,
    roles: rolesMerged,
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, merged, { merge: true });

  // نرجّع snapshot منطقي
  return {
    ...existing,
    ...nextPatch,
    roles: rolesMerged,
  };
}

/**
 * saveUserProfile:
 * - يستخدمه login.html بعد signup/login
 * - يحفظ phone/address/name + activeRole + roles بشكل آمن
 */
export async function saveUserProfile(uid, payload) {
  const p = { ...(payload || {}) };

  if ("phone" in p) p.phone = cleanPhone(p.phone);
  if ("address" in p) p.address = clean(p.address) || null;
  if ("name" in p) p.name = clean(p.name) || null;

  // ✅ roles merge
  const existing = await getUserDoc(uid).catch(() => null);
  const rolesMerged = {
    passenger: true,
    driver: true,
    ...(existing?.roles || {}),
    ...(p.roles || {}),
  };

  delete p.roles;

  await setDoc(
    userRef(uid),
    {
      ...p,
      roles: rolesMerged,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * updateUserProfile:
 * - تحديث خفيف بدون قراءة doc كامل (مع merge roles إن وجدت)
 */
export async function updateUserProfile(uid, payload = {}) {
  const p = { ...(payload || {}) };
  if ("phone" in p) p.phone = cleanPhone(p.phone);
  if ("address" in p) p.address = clean(p.address) || null;
  if ("name" in p) p.name = clean(p.name) || null;

  // لو فيه roles في update، لازم ندمجها
  if (p.roles) {
    const existing = await getUserDoc(uid).catch(() => null);
    p.roles = {
      passenger: true,
      driver: true,
      ...(existing?.roles || {}),
      ...(p.roles || {}),
    };
  }

  await updateDoc(userRef(uid), { ...p, updatedAt: serverTimestamp() });
}

/**
 * getMyProfile:
 * - يجيب بروفايل المستخدم الحالي (لو مسجل دخول)
 */
export async function getMyProfile() {
  const u = auth.currentUser;
  if (!u) return null;
  return await getUserDoc(u.uid).catch(() => null);
}

// ===== Auth actions
export async function emailSignIn(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function emailSignUp(email, password) {
  return await createUserWithEmailAndPassword(auth, email, password);
}

export async function doLogout() {
  try {
    await signOut(auth);
  } catch {}
  try {
    localStorage.removeItem("currentRideId");
  } catch {}
  location.href = "./index.html";
}

/**
 * requireAuthAndRole(requiredRole):
 * - يجبر تسجيل الدخول
 * - يثبت role (لو الصفحة راكب/سائق)
 * - يضمن users/{uid} موجود وفيه phone/address محفوظين لو اتبعتوا قبل
 */
export async function requireAuthAndRole(requiredRole = null) {
  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u || null);
    });
  });

  if (!user) {
    location.href = "./login.html";
    throw new Error("not-authenticated");
  }

  if (requiredRole) setActiveRole(requiredRole);

  // ✅ ensure user doc بدون ما يمسح phone/address/name
  await ensureUserDoc(user.uid, {
    email: user.email || null,
    activeRole: getActiveRole(),
    roles: { passenger: true, driver: true },
  }).catch(() => {});

  const data = await getUserDoc(user.uid).catch(() => null);
  const role = requiredRole || getActiveRole();

  return { user, data: { ...(data || {}), role } };
}