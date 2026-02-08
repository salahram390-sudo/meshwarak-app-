// app.js - Firebase (CDN) + Auth Guards + Helpers
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

// ✅ Firebase Config (بتاعك)
const firebaseConfig = {
  apiKey: "AIzaSyDA9pP-Y3PEvl6675f4pHDyXzayzzmihhI",
  authDomain: "meshwark-8adf8.firebaseapp.com",
  projectId: "meshwark-8adf8",
  storageBucket: "meshwark-8adf8.firebasestorage.app",
  messagingSenderId: "450060838946",
  appId: "1:450060838946:web:963cacdd125b253fa1827b",
  measurementId: "G-GP0JGBZTGG"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// =========================
// Users Helpers
// =========================
export async function getUserDoc(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function ensureUserDoc(uid, patch = {}) {
  // ينشئ/يكمّل users/{uid} بدون ما يكسر الموجود
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  const base = { updatedAt: serverTimestamp(), ...patch };

  if (!snap.exists()) {
    await setDoc(ref, { createdAt: serverTimestamp(), ...base }, { merge: true });
    return;
  }
  await setDoc(ref, base, { merge: true });
}

export async function getMe() {
  const u = auth.currentUser;
  if (!u) return null;
  const data = (await getUserDoc(u.uid)) || {};
  return { uid: u.uid, email: u.email || null, ...data };
}

// =========================
// Auth Guard
// =========================
export function requireAuthAndRole(requiredRole = null) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        location.href = "login.html";
        return;
      }

      const data = await getUserDoc(user.uid);
      if (!data?.role) {
        location.href = "login.html";
        return;
      }

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
