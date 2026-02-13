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
  messagingSenderId: "1059652280517",
  appId: "1:1059652280517:web:6a9d0b2c0c8b56b9cdb4a5",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

setPersistence(auth, browserLocalPersistence).catch(() => {});

const LS_ROLE_KEY = "meshwarak_active_role";

/** role: "passenger" | "driver" */
export function setActiveRole(role) {
  try {
    if (!role) return;
    localStorage.setItem(LS_ROLE_KEY, String(role));
  } catch {}
}

export function getActiveRole() {
  try {
    return localStorage.getItem(LS_ROLE_KEY) || "";
  } catch {
    return "";
  }
}

export async function getUserDoc(uid) {
  if (!uid) return null;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

async function ensureUserDoc(uid, data) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } else {
    await updateDoc(ref, { updatedAt: serverTimestamp() });
  }
}

export async function signupAs({ role, name, phone, address, email, password }) {
  role = role === "driver" ? "driver" : "passenger";
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  await ensureUserDoc(cred.user.uid, {
    role,
    name: name || "",
    phone: phone || "",
    address: address || "",
    email: email || "",
  });

  setActiveRole(role);
  return cred;
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred;
}

export async function doLogout() {
  await signOut(auth);
}

export function onUser(cb) {
  return onAuthStateChanged(auth, cb);
}

/**
 * Require auth AND matching role in Firestore users/{uid}.role
 * If mismatch => throws Error("wrong_role")
 */
export async function requireAuthAndRole(requiredRole) {
  requiredRole = requiredRole === "driver" ? "driver" : "passenger";

  const user = auth.currentUser;
  if (!user) throw new Error("not_signed_in");

  const udoc = await getUserDoc(user.uid);
  const actual = (udoc && udoc.role) ? String(udoc.role) : "";

  if (actual !== requiredRole) {
    const err = new Error("wrong_role");
    err.actualRole = actual;
    err.requiredRole = requiredRole;
    throw err;
  }

  return { user, udoc };
}
