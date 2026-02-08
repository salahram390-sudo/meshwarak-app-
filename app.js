// app.js — SINGLE Firebase init + Auth/Role guard + User profile helpers

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ✅ Firebase config (بتاعك)
export const firebaseConfig = {
  apiKey: "AIzaSyDA9pP-Y3PEvl6675f4pHDyXzayzzmihhI",
  authDomain: "meshwark-8adf8.firebaseapp.com",
  projectId: "meshwark-8adf8",
  storageBucket: "meshwark-8adf8.firebasestorage.app",
  messagingSenderId: "450060838946",
  appId: "1:450060838946:web:963cacdd125b253fa1827b",
  measurementId: "G-GP0JGBZTGG",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// -------------------------
// Helpers
// -------------------------
export function qs(name) {
  return new URL(location.href).searchParams.get(name);
}

export function buildLoginUrl(role = null) {
  const u = new URL("login.html", location.href);
  if (role) u.searchParams.set("role", role);
  // يرجّع المستخدم لنفس الصفحة بعد تسجيل الدخول
  u.searchParams.set("returnTo", location.pathname.split("/").pop());
  return u.toString();
}

export function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

// -------------------------
// Users (users/{uid})
// -------------------------
export async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveUserRole(uid, role) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { role, updatedAt: serverTimestamp() }, { merge: true });
}

export async function saveUserProfile(uid, data) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// ✅ ترجع {user, data} أو تعمل redirect
export function requireAuthAndRole(requiredRole = null) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        location.href = buildLoginUrl(requiredRole);
        return;
      }

      const data = await getUserDoc(user.uid);

      // لو مفيش users doc، نوديه login (أو profile)
      if (!data) {
        location.href = "profile.html";
        return;
      }

      // لو مفيش role محفوظ
      if (!data.role) {
        location.href = "profile.html";
        return;
      }

      // منع فتح صفحة دور مختلف
      if (requiredRole && data.role !== requiredRole) {
        location.href = "index.html";
        return;
      }

      resolve({ user, data });
    });
  });
}

export async function getAuthedUserAndData() {
  const current = auth.currentUser;
  if (!current) return null;
  const data = await getUserDoc(current.uid);
  return { user: current, data };
}

export async function doLogout() {
  await signOut(auth);
  location.href = "login.html";
}
