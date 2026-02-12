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
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ===== Firebase Config (كما عندك)
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

// مهم جدًا علشان الجلسة تفضل محفوظة
try { await setPersistence(auth, browserLocalPersistence); } catch {}

// ===== أدوات عامة
export function qs(name) {
  try { return new URL(location.href).searchParams.get(name); } catch { return null; }
}

const ROLE_KEY = "activeRole";

export function setActiveRole(role) {
  const r = role === "driver" ? "driver" : "passenger";
  localStorage.setItem(ROLE_KEY, r);
  return r;
}

export function getActiveRole() {
  const r = localStorage.getItem(ROLE_KEY);
  return (r === "driver" || r === "passenger") ? r : "passenger";
}

// ===== Firestore helpers
export async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function ensureUserDoc(uid, patch = {}) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const base = {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      roles: { passenger: true, driver: true },
      activeRole: getActiveRole(),
      ...patch,
    };
    await setDoc(ref, base, { merge: true });
    return base;
  } else {
    await setDoc(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
    return snap.data();
  }
}

export async function saveUserProfile(uid, payload) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
}

// ===== Auth actions (هذه كانت ناقصة عندك = سبب الكارثة)
export async function emailSignIn(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function emailSignUp(email, password) {
  return await createUserWithEmailAndPassword(auth, email, password);
}

export async function doLogout() {
  try { await signOut(auth); } catch {}
  location.href = "./index.html";
}

export async function requireAuthAndRole(requiredRole /* "driver" | "passenger" | null */ = null) {
  // انتظار auth state
  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u || null); });
  });

  if (!user) {
    location.href = "./login.html";
    throw new Error("not-authenticated");
  }

  // ضمان user doc
  await ensureUserDoc(user.uid, {
    email: user.email || null,
    roles: { passenger: true, driver: true },
    activeRole: getActiveRole(),
  }).catch(() => {});

  const data = await getUserDoc(user.uid).catch(() => null);

  const role = requiredRole || getActiveRole();
  if (requiredRole && role !== requiredRole) {
    // لو صفحة سائق وهو راكب (أو العكس) نوديه لنفس الصفحة المطلوبة مع role
    setActiveRole(requiredRole);
  }

  return { user, data: { ...(data || {}), role } };
}
