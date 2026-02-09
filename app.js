// app.js - SINGLE Firebase init + helpers (Email/Password) ✅ FINAL
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ✅ Firebase config
export const firebaseConfig = {
  apiKey: "AIzaSyDA9pP-Y3PEvl6675f4pHDyXzayzzmihhI",
  authDomain: "meshwark-8adf8.firebaseapp.com",
  projectId: "meshwark-8adf8",
  storageBucket: "meshwark-8adf8.firebasestorage.app",
  messagingSenderId: "450060838946",
  appId: "1:450060838946:web:963cacdd125b253fa1827b",
  measurementId: "G-GP0JGBZTGG",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// =========================
// Helpers (URL / Safe)
// =========================
export const qs = (k) => new URLSearchParams(location.search).get(k);

export function currentPage() {
  const file = location.pathname.split("/").pop() || "index.html";
  return file + (location.search || "");
}

export function redirectToLogin(requiredRole = null) {
  const returnTo = encodeURIComponent(currentPage());
  const roleQ = requiredRole ? `&role=${encodeURIComponent(requiredRole)}` : "";
  location.href = `login.html?returnTo=${returnTo}${roleQ}`;
}

export async function safeSetDoc(ref, payload) {
  await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
}

// =========================
// Users
// =========================
export async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function upsertUser(uid, payload) {
  const ref = doc(db, "users", uid);
  await safeSetDoc(ref, payload);
}

// ✅ NEW: used by profile.html
export async function saveUserProfile(uid, payload) {
  // نفس upsertUser لكن باسم واضح
  return upsertUser(uid, payload);
}

export function fallbackNameFromEmail(email) {
  const x = (email || "").split("@")[0] || "مستخدم";
  return x.replace(/[._-]+/g, " ").trim() || "مستخدم";
}

/**
 * يضمن وجود بيانات أساسية للمستخدم في users/{uid}
 * - name/email (لو ناقصين)
 * - role لو اتبعت
 */
export async function ensureUserDefaults(user, extra = {}) {
  if (!user?.uid) return;

  const existing = await getUserDoc(user.uid).catch(() => null);
  const patch = { ...extra };

  if (!existing?.email && user.email) patch.email = user.email;
  if (!existing?.name) patch.name = fallbackNameFromEmail(user.email);

  if (Object.keys(patch).length === 0) return;

  await upsertUser(user.uid, patch).catch(() => {});
}

// =========================
// Auth Guard (✅ unsubscribe + stable)
// =========================
export function requireAuthAndRole(requiredRole = null) {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try { unsub(); } catch {}

      if (!user) {
        redirectToLogin(requiredRole);
        return;
      }

      const data = await getUserDoc(user.uid).catch(() => null);

      if (!data?.role) {
        redirectToLogin(requiredRole);
        return;
      }

      if (requiredRole && data.role !== requiredRole) {
        location.href = "index.html";
        return;
      }

      await ensureUserDefaults(user);

      resolve({ user, data });
    });
  });
}

export async function doLogout() {
  await signOut(auth);
  location.href = "login.html";
}
