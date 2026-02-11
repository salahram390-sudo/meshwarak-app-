// app.js — FINAL (Auth + Firestore helpers + Roles + Utils)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/** ✅ Firebase config (زي ما عندك في sw.js) */
const firebaseConfig = {
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

/** ======================
 * ✅ Utils
 * ====================== */
export const clean = (s) => (s || "").trim().replace(/\s+/g, " ");

export function normalizePhone(p) {
  const x = (p || "").trim();
  if (!x) return null;
  const cleaned = x.replace(/[^\d+]/g, "");
  // مرن: على الأقل 8 أرقام
  const digits = cleaned.replace(/[^\d]/g, "");
  return digits.length >= 8 ? cleaned : null;
}

export function qs(key) {
  try {
    return new URL(location.href).searchParams.get(key);
  } catch {
    return null;
  }
}

/** ======================
 * ✅ Role handling
 * ====================== */
const LS_ACTIVE_ROLE = "mw_active_role";

export function setActiveRole(role) {
  const r = role === "driver" ? "driver" : "passenger";
  try { localStorage.setItem(LS_ACTIVE_ROLE, r); } catch {}
  return r;
}

export function getActiveRole() {
  try {
    const r = localStorage.getItem(LS_ACTIVE_ROLE);
    return r === "driver" ? "driver" : "passenger";
  } catch {
    return "passenger";
  }
}

/** ======================
 * ✅ Auth helpers
 * ====================== */
export async function emailSignUp(email, pass) {
  return await createUserWithEmailAndPassword(auth, (email || "").trim(), pass);
}

export async function emailSignIn(email, pass) {
  return await signInWithEmailAndPassword(auth, (email || "").trim(), pass);
}

export async function doLogout() {
  try { await signOut(auth); } catch {}
  try { location.href = "./index.html"; } catch {}
}

/** ======================
 * ✅ Users collection
 * ====================== */
export async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * ✅ ensure user doc exists + merge defaults
 */
export async function ensureUserDoc(uid, defaults = {}) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      roles: { passenger: true, driver: true },
      activeRole: getActiveRole(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...defaults
    }, { merge: true });
    return;
  }

  // merge missing critical fields
  const cur = snap.data() || {};
  const roles = cur.roles || {};
  const patch = {};

  if (!roles.passenger || !roles.driver) {
    patch.roles = { passenger: true, driver: true };
  }
  if (!cur.activeRole) {
    patch.activeRole = getActiveRole();
  }
  if (Object.keys(defaults || {}).length) {
    Object.assign(patch, defaults);
  }
  if (Object.keys(patch).length) {
    patch.updatedAt = serverTimestamp();
    await setDoc(ref, patch, { merge: true });
  }
}

/**
 * ✅ Save user profile safely (merge)
 */
export async function saveUserProfile(uid, payload = {}) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/** ======================
 * ✅ Require auth + role
 * ====================== */
/**
 * @param {"passenger"|"driver"|null} roleRequired
 * - passenger: لازم user doc activeRole = passenger (أو localStorage) + موجود في roles
 * - driver: لازم driver
 * - null: أي دور
 */
export async function requireAuthAndRole(roleRequired = null) {
  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u || null);
    });
  });

  if (!user) {
    const r = roleRequired || getActiveRole();
    location.href = `./login.html?role=${r}`;
    throw new Error("not-authenticated");
  }

  await ensureUserDoc(user.uid, { email: user.email || null }).catch(() => {});
  const data = await getUserDoc(user.uid).catch(() => null);

  const roles = data?.roles || { passenger: true, driver: true };

  // Resolve active role:
  // 1) localStorage
  // 2) user doc activeRole
  // 3) fallback passenger
  const localRole = getActiveRole();
  const docRole = (data?.activeRole === "driver") ? "driver" : "passenger";
  let activeRole = localRole || docRole || "passenger";

  // If roleRequired provided, force it
  if (roleRequired === "driver") activeRole = "driver";
  if (roleRequired === "passenger") activeRole = "passenger";

  // persist
  setActiveRole(activeRole);
  if (data?.activeRole !== activeRole) {
    await saveUserProfile(user.uid, { activeRole }).catch(() => {});
  }

  // role guard
  if (activeRole === "driver" && !roles.driver) {
    await saveUserProfile(user.uid, { roles: { passenger: true, driver: true }, activeRole: "driver" }).catch(() => {});
  }
  if (activeRole === "passenger" && !roles.passenger) {
    await saveUserProfile(user.uid, { roles: { passenger: true, driver: true }, activeRole: "passenger" }).catch(() => {});
  }

  // If explicitly required, verify + redirect
  if (roleRequired && activeRole !== roleRequired) {
    setActiveRole(roleRequired);
    await saveUserProfile(user.uid, { activeRole: roleRequired }).catch(() => {});
    location.href = roleRequired === "driver" ? "./driver.html" : "./passenger.html";
    throw new Error("role-mismatch");
  }

  return { user, data: { ...(data || {}), activeRole } };
}
