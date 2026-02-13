// app.js — FINAL v16 (Fix: Multi-role switching + Authorized domain friendly)
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

// =============================
// Firebase Config
// =============================
const firebaseConfig = {
  apiKey: "AIzaSyDA9pP-Y3PEvl6675f4pHDyXzayzzmihhI",
  authDomain: "meshwark-8adf8.firebaseapp.com",
  projectId: "meshwark-8adf8",
  storageBucket: "meshwark-8adf8.appspot.com",
  messagingSenderId: "1005454766101",
  appId: "1:1005454766101:web:6a2f9f2f2a4d2c0d86e3e4"
};

// =============================
// Init
// =============================
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// =============================
// Helpers
// =============================
export function clean(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

export function toast(msg) {
  try {
    const el = document.getElementById("msg");
    if (el) el.textContent = msg;
  } catch {}
}

export async function getUserDoc(uid) {
  if (!uid) return null;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

export async function ensureUserDoc(uid, email) {
  if (!uid) return;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid,
      email: email || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      role: "passenger", // default
      activeRole: "passenger",
    });
  }
}

// =============================
// Auth Actions
// =============================
export async function doLogin(email, password) {
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDoc(cred.user.uid, cred.user.email);
  return cred.user;
}

export async function doRegister(email, password) {
  await setPersistence(auth, browserLocalPersistence);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserDoc(cred.user.uid, cred.user.email);
  return cred.user;
}

export async function doLogout() {
  await signOut(auth);
}

// =============================
// Roles
// =============================
export async function setActiveRole(role) {
  role = clean(role);
  if (!role) return;

  const u = auth.currentUser;
  if (!u) return;

  const ref = doc(db, "users", u.uid);
  await updateDoc(ref, {
    activeRole: role,
    updatedAt: serverTimestamp(),
  });

  localStorage.setItem("activeRole", role);
}

export async function requireAuthAndRole(allowedRoles = []) {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          unsub();
          reject(new Error("not_logged_in"));
          return;
        }

        // Ensure user doc exists
        await ensureUserDoc(user.uid, user.email);

        // Load user doc
        const uDoc = await getUserDoc(user.uid);

        const roleFromDoc = clean(uDoc?.activeRole || uDoc?.role || "");
        const roleFromLocal = clean(localStorage.getItem("activeRole") || "");

        // Prefer doc role, fallback local
        const role = roleFromDoc || roleFromLocal || "passenger";

        // Enforce allowed roles if provided
        if (allowedRoles.length && !allowedRoles.includes(role)) {
          unsub();
          reject(new Error("wrong_role"));
          return;
        }

        // Update UI who
        try {
          const who = document.getElementById("who");
          if (who) who.textContent = `${user.email} • ${role === "driver" ? "سائق" : "راكب"}`;
        } catch {}

        unsub();
        resolve({ user, role, uDoc });
      } catch (e) {
        unsub();
        reject(e);
      }
    });
  });
}

// =============================
// Auto bind logout button
// =============================
(function bindLogout() {
  try {
    const btn = document.getElementById("logoutBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      try {
        await doLogout();
        window.location.href = "./index.html";
      } catch (e) {
        console.error(e);
      }
    });
  } catch {}
})();
