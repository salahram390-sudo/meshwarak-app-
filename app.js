// app.js - SINGLE Firebase init + helpers
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
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

// ✅ قراءة query string بسهولة
export function qs(key) {
  return new URLSearchParams(location.search).get(key);
}

// =========================
// Users
// =========================
export async function saveUserRole(uid, role) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { role, updatedAt: serverTimestamp() }, { merge: true });
}

export async function saveUserProfile(uid, data) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * يمنع فتح أي صفحة محمية لو المستخدم مش عامل Login
 * ولو requiredRole متحدد: يمنع راكب يفتح السائق والعكس
 */
export function requireAuthAndRole(requiredRole = null) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        location.href = "login.html?returnTo=" + encodeURIComponent(location.pathname.split("/").pop());
        return;
      }

      const data = await getUserDoc(user.uid);

      // لو مفيش role محفوظ
      if (!data?.role) {
        location.href = "login.html?returnTo=" + encodeURIComponent(location.pathname.split("/").pop());
        return;
      }

      // لو الصفحة بتطلب role معين
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
