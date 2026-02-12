// app.js — FINAL (Exports fixed + Auth/Firestore helpers) ✅
// Works with: index.html, login.html, profile.html, trip.html, passenger.html, driver.html
// Firebase v10.12.5 (CDN modular)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ======================
// ✅ Firebase config
// ======================
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

// ======================
// ✅ Role helpers
// ======================
const LS_ACTIVE_ROLE = "mw_active_role"; // "passenger" | "driver"
const LS_LAST_ROLE = "mw_last_role";     // used by login.html too

export function getActiveRole() {
  const r = (localStorage.getItem(LS_ACTIVE_ROLE) || "").trim();
  return r === "driver" ? "driver" : "passenger";
}

export function setActiveRole(role) {
  const r = role === "driver" ? "driver" : "passenger";
  try {
    localStorage.setItem(LS_ACTIVE_ROLE, r);
    localStorage.setItem(LS_LAST_ROLE, r);
  } catch {}
  return r;
}

// ======================
// ✅ Small utils
// ======================
export function qs(name) {
  try {
    return new URL(location.href).searchParams.get(name);
  } catch {
    return null;
  }
}

function clean(s) {
  return (s || "").toString().trim().replace(/\s+/g, " ");
}

function safeRedirect(url) {
  try {
    location.href = url;
  } catch {
    location.assign(url);
  }
}

// ======================
// ✅ Auth exports (FIX for your error)
// ======================
export async function emailSignUp(email, password) {
  const e = clean(email);
  const p = (password || "").toString();
  return await createUserWithEmailAndPassword(auth, e, p);
}

export async function emailSignIn(email, password) {
  const e = clean(email);
  const p = (password || "").toString();
  return await signInWithEmailAndPassword(auth, e, p);
}

// ======================
// ✅ Firestore user doc helpers
// ======================
export async function ensureUserDoc(uid, seed = {}) {
  if (!uid) throw new Error("missing uid");
  const ref = doc(db, "users", uid);

  const snap = await getDoc(ref);
  if (snap.exists()) {
    // if exists, we can still merge missing essentials safely
    const data = snap.data() || {};
    const patch = {};

    // roles defaults
    if (!data.roles) patch.roles = { passenger: true, driver: true };
    if (!data.activeRole) patch.activeRole = getActiveRole();
    if (!data.email && seed.email) patch.email = seed.email;

    if (Object.keys(patch).length) {
      patch.updatedAt = serverTimestamp();
      await setDoc(ref, patch, { merge: true });
    }
    return;
  }

  const payload = {
    roles: { passenger: true, driver: true },
    activeRole: getActiveRole(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...seed,
  };

  // ensure seed doesn't break defaults
  payload.roles = payload.roles || { passenger: true, driver: true };
  payload.activeRole = payload.activeRole || getActiveRole();

  await setDoc(ref, payload, { merge: true });
}

export async function getUserDoc(uid) {
  if (!uid) throw new Error("missing uid");
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveUserProfile(uid, payload = {}) {
  if (!uid) throw new Error("missing uid");
  const ref = doc(db, "users", uid);

  const patch = {
    ...payload,
    updatedAt: serverTimestamp(),
  };

  // normalize roles/activeRole if provided
  if (patch.activeRole) patch.activeRole = patch.activeRole === "driver" ? "driver" : "passenger";
  if (patch.roles) {
    patch.roles = {
      passenger: patch.roles.passenger !== false,
      driver: patch.roles.driver !== false,
    };
  }

  await setDoc(ref, patch, { merge: true });
}

// ======================
// ✅ Logout
// ======================
export async function doLogout() {
  try {
    await signOut(auth);
  } catch {}
  safeRedirect("./index.html");
}

// ======================
// ✅ Auth guard (role optional)
// ======================
export async function requireAuthAndRole(requiredRole = null) {
  // requiredRole: "driver" | "passenger" | null (any)
  const roleWanted = requiredRole === "driver" ? "driver" : requiredRole === "passenger" ? "passenger" : null;

  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u || null);
    });
  });

  if (!user) {
    // if roleWanted -> keep it in url
    const r = roleWanted || getActiveRole();
    setActiveRole(r);
    safeRedirect(`./login.html?role=${r}`);
    throw new Error("not-authenticated");
  }

  // ensure doc exists
  await ensureUserDoc(user.uid, {
    email: user.email || null,
    roles: { passenger: true, driver: true },
    activeRole: getActiveRole(),
  }).catch(() => {});

  const data = await getUserDoc(user.uid).catch(() => null);
  const active = (data?.activeRole || getActiveRole()) === "driver" ? "driver" : "passenger";

  // keep local role synced
  setActiveRole(active);

  // if role is required, enforce it
  if (roleWanted && active !== roleWanted) {
    setActiveRole(roleWanted);
    await saveUserProfile(user.uid, { activeRole: roleWanted }).catch(() => {});
    safeRedirect(roleWanted === "driver" ? "./driver.html" : "./passenger.html");
    throw new Error("role-mismatch-redirected");
  }

  return { user, data: { ...(data || {}), role: active } };
}
