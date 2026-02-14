// app.js — FINAL ✅ (Firestore Rules compatible + GitHub Pages friendly)
// Firebase v10 modular CDN

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
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
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// =====================
// ✅ Firebase Config (كما في مشروعك)
// =====================
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

// ✅ يحافظ على الجلسة على GitHub Pages / الموبايل
try {
  await setPersistence(auth, browserLocalPersistence);
} catch {}

// =====================
// Helpers
// =====================
export function qs(name) {
  try { return new URL(location.href).searchParams.get(name); } catch { return null; }
}
const clean = (s) => (s ?? "").toString().trim().replace(/\s+/g, " ");
const cleanPhone = (p) => {
  const x = clean(p);
  if (!x) return null;
  return x.replace(/[^\d+]/g, "");
};

// =====================
// Role local storage
// =====================
export const ROLE_KEY = "activeRole";
export function setActiveRole(role) {
  const r = role === "driver" ? "driver" : "passenger";
  localStorage.setItem(ROLE_KEY, r);
  return r;
}
export function getActiveRole() {
  const r = localStorage.getItem(ROLE_KEY);
  return (r === "driver" || r === "passenger") ? r : "passenger";
}

// =====================
// Firestore users/{uid} (Rules-compatible)
// allowed keys only:
// role,name,email,phone,address,governorate,center,vehicleType,vehicleModel,vehiclePlate,createdAt,updatedAt
// =====================
export function userRef(uid) {
  return doc(db, "users", uid);
}

export async function getUserDoc(uid) {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? snap.data() : null;
}

function sanitizeUserPatch(patch = {}) {
  const p = { ...(patch || {}) };

  // Normalize allowed fields
  if ("role" in p) p.role = (p.role === "driver") ? "driver" : "passenger";
  if ("name" in p) p.name = clean(p.name) || null;
  if ("email" in p) p.email = clean(p.email).toLowerCase() || null;
  if ("phone" in p) p.phone = cleanPhone(p.phone);
  if ("address" in p) p.address = clean(p.address) || null;
  if ("governorate" in p) p.governorate = clean(p.governorate) || null;
  if ("center" in p) p.center = clean(p.center) || null;
  if ("vehicleType" in p) p.vehicleType = clean(p.vehicleType) || null;
  if ("vehicleModel" in p) p.vehicleModel = clean(p.vehicleModel) || null;
  if ("vehiclePlate" in p) p.vehiclePlate = clean(p.vehiclePlate) || null;

  // Drop anything not allowed by rules
  const allowed = new Set([
    "role","name","email","phone","address",
    "governorate","center",
    "vehicleType","vehicleModel","vehiclePlate",
    "createdAt","updatedAt"
  ]);
  for (const k of Object.keys(p)) {
    if (!allowed.has(k)) delete p[k];
  }
  return p;
}

/**
 * ensureUserDoc:
 * - Creates the doc if not exists
 * - Updates allowed fields only
 */
export async function ensureUserDoc(uid, patch = {}) {
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  const p = sanitizeUserPatch(patch);

  if (!snap.exists()) {
    const base = {
      role: p.role ?? getActiveRole(),
      name: p.name ?? null,
      phone: p.phone ?? null,
      address: p.address ?? null,
      governorate: p.governorate ?? null,
      center: p.center ?? null,
      vehicleType: p.vehicleType ?? null,
      vehicleModel: p.vehicleModel ?? null,
      vehiclePlate: p.vehiclePlate ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, base, { merge: true });
    return base;
  }

  const update = {
    ...p,
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, update, { merge: true });
  return { ...(snap.data() || {}), ...p };
}

/**
 * saveUserProfile:
 * Used by login.html after sign-up / sign-in.
 * Always safe with your Firestore Rules.
 */
export async function saveUserProfile(uid, payload = {}) {
  const p = sanitizeUserPatch(payload);
  // createdAt only on first time (ensureUserDoc handles)
  return await ensureUserDoc(uid, p);
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
  try { await signOut(auth); } catch {}
  try { localStorage.removeItem("currentRideId"); } catch {}
  location.href = "./index.html";
}

/**
 * requireAuthAndRole(requiredRole):
 * - Enforce login (redirect to login.html)
 * - Sets active role for this page (passenger/driver)
 * - Ensures users/{uid} exists with allowed fields only
 */
export async function requireAuthAndRole(requiredRole = null) {
  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u || null); });
  });

  if (!user) {
    location.href = "./login.html";
    throw new Error("not-authenticated");
  }

  if (requiredRole) setActiveRole(requiredRole);

  // ✅ Create/update users/{uid} safely (Rules compatible)
  await ensureUserDoc(user.uid, { role: getActiveRole() }).catch(() => {});

  const data = await getUserDoc(user.uid).catch(() => null);
  const role = requiredRole || getActiveRole();
  return { user, data: { ...(data || {}), role } };
}
