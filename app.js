// app.js — FINAL v6 (Stable + Role + Auth Guards + Profile Save + Toast)
// مشوارك — GitHub Pages safe

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// =====================
// Firebase Config
// =====================
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

// =====================
// Helpers
// =====================
export function go(url) {
  location.href = url;
}

export function qs(k) {
  try {
    return new URLSearchParams(location.search).get(k);
  } catch {
    return null;
  }
}

export function safeText(x) {
  return (x ?? "").toString();
}

// =====================
// Role (local + user doc)
// =====================
const ROLE_KEY = "meshwarak_role";

export function setRoleLocal(role) {
  const r = role === "driver" ? "driver" : "passenger";
  localStorage.setItem(ROLE_KEY, r);
  return r;
}

export function getRoleLocal() {
  return localStorage.getItem(ROLE_KEY) || "passenger";
}

// Backward compatibility for old code
export function setActiveRole(role) {
  return setRoleLocal(role);
}

// =====================
// Toast (simple)
// =====================
let _toastT = null;

export function toast(html, ms = 2600) {
  const el = document.getElementById("toast");
  if (!el) return;

  el.innerHTML = html;
  el.classList.add("show");

  clearTimeout(_toastT);
  _toastT = setTimeout(() => el.classList.remove("show"), ms);
}

// =====================
// Auth guards
// =====================
export function waitAuthOnce() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      try { unsub(); } catch {}
      resolve(user || null);
    });
  });
}

// لو المستخدم بالفعل داخل: ودّيه للصفحة المناسبة
export async function requireNoAuth() {
  const user = await waitAuthOnce();
  if (user) {
    const role = getRoleLocal();
    if (role === "driver") go("./driver.html");
    else go("./passenger.html");
    throw new Error("already authed");
  }
  return true;
}

// requireAuthAndRole(roleOrNull)
// - لو roleOrNull = "driver" أو "passenger" -> لازم نفس الدور
// - لو null -> بس لازم يكون داخل
export async function requireAuthAndRole(roleOrNull = null) {
  const user = await waitAuthOnce();
  if (!user) {
    go("./index.html");
    throw new Error("not authed");
  }

  // اقرأ user doc
  const data = await getUserDoc(user.uid).catch(() => null);

  // role الحالي (local أولاً)
  const localRole = getRoleLocal();
  const role = localRole || data?.activeRole || "passenger";

  // لو مطلوب دور معين
  if (roleOrNull && role !== roleOrNull) {
    // لو الصفحة سائق وهو راكب: ودّيه
    if (roleOrNull === "driver") go("./driver.html");
    else go("./passenger.html");
    throw new Error("wrong role");
  }

  return { user, data: { ...(data || {}), role } };
}

// =====================
// User Doc
// =====================
export async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// يضمن وجود user doc
export async function ensureUserDoc(uid, payload = {}) {
  const base = {
    roles: { passenger: true, driver: true },
    activeRole: "passenger",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", uid), { ...base, ...payload }, { merge: true });
}

export async function saveUserProfile(uid, payload = {}) {
  const patch = {
    ...payload,
    updatedAt: serverTimestamp(),
  };

  // لا تكتب undefined أبداً
  Object.keys(patch).forEach((k) => {
    if (patch[k] === undefined) delete patch[k];
  });

  await setDoc(doc(db, "users", uid), patch, { merge: true });
}

// =====================
// Logout
// =====================
export async function doLogout() {
  try {
    await signOut(auth);
  } catch {}
  go("./index.html");
}
