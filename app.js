// app.js — FINAL (Email/Password + Auto Signup + Persistence)
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
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ✅ لازم تحط القيم الصح من Firebase Project settings
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",           // مثال: meshwark-8adf8.firebaseapp.com
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ خلي الجلسة محفوظة على طول
setPersistence(auth, browserLocalPersistence).catch(() => {});

// ========= utils
export function qs(key) {
  const u = new URL(location.href);
  return u.searchParams.get(key);
}

export function normalizeEmail(input) {
  let x = String(input || "").trim().toLowerCase();
  if (!x) return null;

  // اسم بدون @ => ايميل وهمي صالح
  if (!x.includes("@")) {
    x = x.replace(/\s+/g, "").replace(/[^\w.-]/g, "");
    if (!x) x = "user";
    return `${x}@meshwarak.local`;
  }

  // لو كتب "name@" بس
  if (/^[^@]+@$/.test(x)) return x + "meshwarak.local";

  return x;
}

export function normalizePassword(input) {
  const x = String(input || "").trim();
  return x.length >= 6 ? x : null;
}

// ========= users helpers
export async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function ensureUserDoc(uid, patch = {}) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(
      ref,
      {
        role: patch.role || "passenger",
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
  return false;
}

export async function saveUserProfile(uid, payload) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
}

// ========= ✅ Auto: signIn else create
export async function emailLoginOrSignup(emailRaw, passRaw) {
  const email = normalizeEmail(emailRaw);
  const password = normalizePassword(passRaw);
  if (!email) throw { code: "bad-email" };
  if (!password) throw { code: "bad-pass" };

  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    const code = e?.code || "";

    // لو مش موجود -> أنشئه
    if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
      return await createUserWithEmailAndPassword(auth, email, password);
    }

    throw e;
  }
}

// ========= auth guard
export async function requireAuthAndRole(requiredRole = null) {
  const user = await new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => { unsub(); resolve(u); },
      (e) => { unsub(); reject(e); }
    );
  });

  if (!user) {
    location.href = "./login.html";
    throw new Error("not signed in");
  }

  let data = await getUserDoc(user.uid).catch(() => null);
  if (!data) {
    await ensureUserDoc(user.uid, {
      role: "passenger",
      email: user.email || null,
      name: null,
    });
    data = await getUserDoc(user.uid).catch(() => null);
  }

  const role = data?.role || null;
  if (requiredRole && role !== requiredRole) {
    location.href = "./index.html";
    throw new Error("wrong role");
  }

  return { user, data };
}

export async function doLogout() {
  await signOut(auth);
  location.href = "./login.html";
}
