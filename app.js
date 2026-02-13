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

const firebaseConfig = {
  apiKey: "AIzaSyDA9pP-Y3PEvl6675f4pHDyXzayzzmihhI",
  authDomain: "meshwark-8adf8.firebaseapp.com",
  projectId: "meshwark-8adf8",
  storageBucket: "meshwark-8adf8.appspot.com",
  messagingSenderId: "1002370933574",
  appId: "1:1002370933574:web:7b5ec4a70f13f2a7d8d8a9",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// =========================
// Role helpers
// =========================
const ROLE_KEY = "meshwarak_active_role";
export function setActiveRole(role) {
  if (!role) return;
  localStorage.setItem(ROLE_KEY, role);
}
export function getActiveRole() {
  return localStorage.getItem(ROLE_KEY) || "";
}

// =========================
// Auth helpers
// =========================
export async function signIn(email, password) {
  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUp(email, password) {
  await setPersistence(auth, browserLocalPersistence);
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function doLogout() {
  return signOut(auth);
}

export function onUser(cb) {
  return onAuthStateChanged(auth, cb);
}

// =========================
// Users collection
// =========================
export async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function ensureUserDoc(uid, data) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...data, createdAt: serverTimestamp() });
  }
}

export async function updateUserDoc(uid, data) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

// =========================
// Guard: require auth + role
// =========================
export async function requireAuthAndRole(requiredRole) {
  const user = auth.currentUser;
  if (!user) {
    // مش داخل — روح للصفحة الرئيسية
    location.href = "./index.html";
    throw new Error("not_signed_in");
  }

  const u = await getUserDoc(user.uid);
  const role = (u && (u.role || u.type || u.userType)) ? (u.role || u.type || u.userType) : "";

  if (!role) {
    location.href = "./index.html";
    throw new Error("no_role");
  }

  if (requiredRole && role !== requiredRole) {
    // دور غلط — روح للصفحة الرئيسية
    location.href = "./index.html";
    throw new Error("wrong_role");
  }

  return { user, role, profile: u || {} };
}
