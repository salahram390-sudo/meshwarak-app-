// app.js — FINAL v17 (Hardened auth/roles + safer helpers + stable redirects)
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
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ================= Firebase config =================
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

// keep user signed in (best effort)
setPersistence(auth, browserLocalPersistence).catch(() => {});

// ================= Utils =================
export function qs(key) {
  try {
    const u = new URL(location.href);
    return u.searchParams.get(key);
  } catch {
    return null;
  }
}

export function clean(x) {
  return String(x || "").trim().replace(/\s+/g, " ");
}

export function safeRedirect(path) {
  try {
    location.href = path;
  } catch {
    // fallback
    window.location.assign(path);
  }
}

// ================= Active role per device =================
const LS_ACTIVE_ROLE = "mw_active_role";
export function setActiveRole(role) {
  if (role !== "passenger" && role !== "driver") return;
  try {
    localStorage.setItem(LS_ACTIVE_ROLE, role);
  } catch {}
}
export function getActiveRole() {
  try {
    const r = localStorage.getItem(LS_ACTIVE_ROLE);
    return r === "passenger" || r === "driver" ? r : null;
  } catch {
    return null;
  }
}

// ================= Normalizers =================
export function normalizeEmail(input) {
  let x = String(input || "").trim().toLowerCase();
  if (!x) return null;

  // if user typed a real email, keep it
  if (x.includes("@")) return x;

  // optional fallback (still valid email format)
  x = x.replace(/\s+/g, "").replace(/[^\w.-]/g, "");
  if (!x) x = "user";
  return `${x}@meshwarak.local`;
}

export function normalizePassword(input) {
  const x = String(input || "").trim();
  return x.length >= 6 ? x : null;
}

export function normalizePhone(input) {
  let x = String(input || "").trim();
  if (!x) return null;

  // Arabic digits → Latin digits
  const map = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
  x = x.replace(/[٠-٩]/g, (d) => map[d] ?? d);

  // keep digits and +
  x = x.replace(/[^\d+]/g, "");
  if (x.includes("+")) x = "+" + x.replace(/\+/g, "");
  if (x.startsWith("00")) x = "+" + x.slice(2);

  // Egypt local mobile → +20
  if (/^01\d{9}$/.test(x)) x = "+20" + x;
  if (/^201\d{9}$/.test(x)) x = "+20" + x.slice(2);

  // E.164-ish
  if (x.startsWith("+")) {
    const digits = x.slice(1);
    if (!/^\d{8,15}$/.test(digits)) return null;
    return "+" + digits;
  }

  if (!/^\d{8,15}$/.test(x)) return null;
  return x;
}

// ================= Firestore helpers =================
export async function getUserDoc(uid) {
  if (!uid) return null;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function ensureUserDoc(uid, patch = {}) {
  if (!uid) return false;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const roles = patch.roles || { passenger: true, driver: false };
    const activeRole = patch.activeRole || (roles.driver ? "driver" : "passenger");

    await setDoc(
      ref,
      {
        roles,
        activeRole,

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
      },
      { merge: true }
    );
    return true;
  }

  // If exists, still make sure minimum fields exist (safe merge)
  try {
    const cur = snap.data() || {};
    const roles = cur.roles || patch.roles || { passenger: true, driver: false };
    const activeRole = cur.activeRole || patch.activeRole || "passenger";
    await setDoc(ref, { roles, activeRole, updatedAt: serverTimestamp() }, { merge: true });
  } catch {}

  return false;
}

export async function saveUserProfile(uid, payload) {
  if (!uid) throw new Error("bad-uid");
  const ref = doc(db, "users", uid);

  // sanitize common fields
  const safe = { ...payload };
  if ("email" in safe) safe.email = safe.email ? clean(safe.email).toLowerCase() : null;
  if ("name" in safe) safe.name = safe.name ? clean(safe.name) : null;
  if ("phone" in safe) safe.phone = safe.phone ? normalizePhone(safe.phone) : null;

  await setDoc(ref, { ...safe, updatedAt: serverTimestamp() }, { merge: true });
}

// Enable role safely for same account
export async function enableRole(uid, role) {
  if (!uid) return;
  if (role !== "passenger" && role !== "driver") return;

  const ref = doc(db, "users", uid);

  // ensure doc exists
  await ensureUserDoc(uid, { roles: { passenger: true, driver: false }, activeRole: "passenger" }).catch(() => {});

  // update nested role
  try {
    await updateDoc(ref, {
      activeRole: role,
      [`roles.${role}`]: true,
      updatedAt: serverTimestamp(),
    });
  } catch {
    await setDoc(ref, { activeRole: role, roles: { [role]: true }, updatedAt: serverTimestamp() }, { merge: true });
  }

  setActiveRole(role);
}

// ================= Auth wrappers =================
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

// ================= Guard =================
export async function requireAuthAndRole(requiredRole = null) {
  const user = await new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        unsub();
        resolve(u);
      },
      (e) => {
        unsub();
        reject(e);
      }
    );
  });

  if (!user) {
    safeRedirect("./login.html");
    throw new Error("not_signed_in");
  }

  let data = await getUserDoc(user.uid).catch(() => null);

  if (!data) {
    await ensureUserDoc(user.uid, {
      roles: { passenger: true, driver: false },
      activeRole: "passenger",
      email: user.email || null,
    }).catch(() => {});
    data = await getUserDoc(user.uid).catch(() => null);
  }

  const localRole = getActiveRole();
  const docRole = data?.activeRole;
  const activeRole = localRole || docRole || "passenger";

  // keep doc in sync with device choice (best effort)
  if (localRole && localRole !== docRole) {
    try {
      await setDoc(doc(db, "users", user.uid), { activeRole: localRole, updatedAt: serverTimestamp() }, { merge: true });
      data = { ...(data || {}), activeRole: localRole };
    } catch {}
  }

  if (requiredRole && activeRole !== requiredRole) {
    safeRedirect("./index.html");
    throw new Error("wrong_role");
  }

  return { user, data, activeRole };
}

export async function doLogout() {
  try {
    await signOut(auth);
  } catch {}
  try {
    localStorage.removeItem(LS_ACTIVE_ROLE);
  } catch {}
  safeRedirect("./login.html");
}
