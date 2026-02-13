// app.js — FINAL (Multi-role + GitHub Pages friendly)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// =====================
// ✅ Firebase Config
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyDA9pP-Y3PEvl6675f4pHDyXzayzzmihhI",
  authDomain: "meshwark-8adf8.firebaseapp.com",
  projectId: "meshwark-8adf8",
  storageBucket: "meshwark-8adf8.appspot.com",
  messagingSenderId: "1027810072175",
  appId: "1:1027810072175:web:1a8e4b1a5b2d5f0c123456",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// =====================
// Helpers
// =====================
function clean(s) {
  return (s || "").toString().trim();
}

function cleanPhone(s) {
  const x = clean(s).replace(/[^\d+]/g, "");
  return x || null;
}

const LS_ROLE = "activeRole";

export function setActiveRole(role) {
  const r = clean(role);
  if (!r) return;
  localStorage.setItem(LS_ROLE, r);
}

export function getActiveRole() {
  return localStorage.getItem(LS_ROLE) || "passenger";
}

// =====================
// Users
// =====================
function userRef(uid) {
  return doc(db, "users", uid);
}

export async function getUserDoc(uid) {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? snap.data() : null;
}

export async function ensureUserDoc(uid, patch = {}) {
  const ref = userRef(uid);
  const snap = await getDoc(ref);

  const base = {
    uid,
    email: patch.email || null,
    roles: { passenger: true, driver: true },
    activeRole: patch.activeRole || getActiveRole(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!snap.exists()) {
    await setDoc(ref, { ...base, ...patch });
    return;
  }

  // ✅ ما نمسحش بيانات موجودة (name/phone/address)
  const old = snap.data() || {};
  const merged = {
    ...patch,
    roles: {
      passenger: true,
      driver: true,
      ...(old.roles || {}),
      ...(patch.roles || {}),
    },
    activeRole: patch.activeRole || old.activeRole || getActiveRole(),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(ref, merged);
}

export async function updateMyProfile(patch = {}) {
  const u = auth.currentUser;
  if (!u) throw new Error("not-authenticated");

  const p = { ...patch };
  if ("phone" in p) p.phone = cleanPhone(p.phone);
  if ("address" in p) p.address = clean(p.address) || null;
  if ("name" in p) p.name = clean(p.name) || null;

  // لو فيه roles لازم ندمجها
  if (p.roles) {
    const existing = await getUserDoc(u.uid).catch(() => null);
    p.roles = {
      passenger: true,
      driver: true,
      ...(existing?.roles || {}),
      ...(p.roles || {}),
    };
  }

  await updateDoc(userRef(u.uid), { ...p, updatedAt: serverTimestamp() });
}

export async function getMyProfile() {
  const u = auth.currentUser;
  if (!u) return null;
  return await getUserDoc(u.uid).catch(() => null);
}

// =====================
// Auth actions
// =====================
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

// =====================
// ✅ Require Auth + Role
// =====================
export async function requireAuthAndRole(requiredRole = null) {
  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u || null);
    });
  });

  if (!user) {
    // ✅ لو مش مسجل دخول — روح لصفحة تسجيل الدخول
    location.href = "./login.html";
    throw new Error("not-authenticated");
  }

  if (requiredRole) setActiveRole(requiredRole);

  // ✅ ensure user doc موجود
  await ensureUserDoc(user.uid, {
    email: user.email || null,
    activeRole: getActiveRole(),
    roles: { passenger: true, driver: true },
  }).catch(() => {});

  const data = await getUserDoc(user.uid).catch(() => null);
  const role = requiredRole || getActiveRole();

  return { user, data: { ...(data || {}), role } };
}
