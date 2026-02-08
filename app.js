// app.js - SINGLE Firebase init + helpers (Email/Password)
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

// ✅ Firebase config (بتاعك)
export const firebaseConfig = {
  apiKey: "AIzaSyDA9pP-Y3PEvl6675f4pHDyXzayzzmihhI",
  authDomain: "meshwark-8adf8.firebaseapp.com",
  projectId: "meshwark-8adf8",
  storageBucket: "meshwark-8adf8.firebasestorage.app",
  messagingSenderId: "450060838946",
  appId: "1:450060838946:web:963cacdd125b253fa1827b",
  measurementId: "G-GP0JGBZTGG"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// =========================
// Helpers
// =========================
export const qs = (k) => new URLSearchParams(location.search).get(k);

export async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function upsertUser(uid, payload) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
}

// =========================
// Auth Guard
// =========================
export function requireAuthAndRole(requiredRole = null) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        const returnTo = encodeURIComponent(location.pathname.split("/").pop() || "index.html");
        const roleQ = requiredRole ? `&role=${encodeURIComponent(requiredRole)}` : "";
        location.href = `login.html?returnTo=${returnTo}${roleQ}`;
        return;
      }

      const data = await getUserDoc(user.uid).catch(() => null);

      // لازم role
      if (!data?.role) {
        const returnTo = encodeURIComponent(location.pathname.split("/").pop() || "index.html");
        const roleQ = requiredRole ? `&role=${encodeURIComponent(requiredRole)}` : "";
        location.href = `login.html?returnTo=${returnTo}${roleQ}`;
        return;
      }

      // منع راكب يفتح السائق والعكس
      if (requiredRole && data.role !== requiredRole) {
        location.href = "index.html";
        return;
      }

      resolve({ user, data });
    });
  });
}

export async function doLogout() {
  await signOut(auth);
  location.href = "login.html";
}
