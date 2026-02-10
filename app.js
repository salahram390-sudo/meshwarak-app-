// app.js — FINAL v12 (Email/Password) + Firestore helpers + Phone helpers — Mashwarak
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

// ✅ Firebase config (بتاعك)
const firebaseConfig = {
  apiKey: "AIzaSyDA9pP-Y3PEvl6675f4pHDyXzayzzmihhI",
  authDomain: "meshwark-8adf8.firebaseapp.com",
  projectId: "meshwark-8adf8",
  storageBucket: "meshwark-8adf8.appspot.com", // ✅ صح
  messagingSenderId: "450060838946",
  appId: "1:450060838946:web:963cacdd125b253fa1827b",
};

// ========= init
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ خلي الجلسة تفضل محفوظة (حتى بعد إغلاق المتصفح)
setPersistence(auth, browserLocalPersistence).catch(() => {});

// ========= utils
export function qs(key) {
  const u = new URL(location.href);
  return u.searchParams.get(key);
}

// ✅ لو المستخدم كتب "salah" فقط بدون @ → يتحول تلقائيًا لـ salah@meshwarak.local
export function normalizeEmail(input) {
  let x = String(input || "").trim().toLowerCase();
  if (!x) return null;

  if (!x.includes("@")) {
    x = x.replace(/\s+/g, "").replace(/[^\w.-]/g, "");
    if (!x) x = "user";
    return `${x}@meshwarak.local`;
  }

  // لو كتب salah@
  if (/^[^@]+@$/.test(x)) return x + "meshwarak.local";

  return x;
}

export function normalizePassword(input) {
  const x = String(input || "").trim();
  return x.length >= 6 ? x : null;
}

// ✅ Phone normalization (EG-focused لكن يقبل أي رقم دولي بشكل مبسط)
// - يقبل: 010..., +2010..., 2010...
// - يخزن كـ string (بدون مسافات)
export function normalizePhone(input) {
  let x = String(input || "").trim();
  if (!x) return null;

  // أرقام عربية/فارسي → إنجليزي
  const map = { "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9" };
  x = x.replace(/[٠-٩]/g, (d) => map[d] ?? d);

  // شيل أي حاجة غير + أو رقم
  x = x.replace(/[^\d+]/g, "");

  // لو فيه + في النص خليه أول حرف فقط
  if (x.includes("+")) {
    x = "+" + x.replace(/\+/g, "");
  }

  // تحويل 00 → +
  if (x.startsWith("00")) x = "+" + x.slice(2);

  // لو رقم مصر محلي 01xxxxxxxxx → +20...
  if (/^01\d{9}$/.test(x)) x = "+20" + x;

  // لو 201xxxxxxxxx → +20...
  if (/^201\d{9}$/.test(x)) x = "+20" + x.slice(2);

  // لو +201xxxxxxxxx تمام
  // قبول عام: + و 8-15 رقم
  if (x.startsWith("+")) {
    const digits = x.slice(1);
    if (!/^\d{8,15}$/.test(digits)) return null;
    return "+" + digits;
  }

  // لو بدون +: لازم 8-15 رقم (هنخزنها زي ما هي)
  if (!/^\d{8,15}$/.test(x)) return null;
  return x;
}

export function formatPhoneForDisplay(phone) {
  const p = String(phone || "").trim();
  if (!p) return "-";
  return p;
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

        // driver
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

// ✅ تحديث رقم الهاتف فقط (مفيد في login/profile)
export async function setUserPhone(uid, phoneRaw) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) throw new Error("bad-phone");
  await saveUserProfile(uid, { phone });
  return phone;
}

// ========= ✅ Auto Login: signIn else createUser
export async function emailLoginOrSignup(emailRaw, passRaw) {
  const email = normalizeEmail(emailRaw);
  const password = normalizePassword(passRaw);

  if (!email) throw new Error("bad-email");
  if (!password) throw new Error("bad-pass");

  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    const code = e?.code || "";

    // لو الحساب مش موجود -> Signup
    if (
      code === "auth/user-not-found" ||
      code === "auth/invalid-credential" ||
      code === "auth/invalid-login-credentials"
    ) {
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
    location.href = "./login.html";
    throw new Error("not signed in");
  }

  let data = await getUserDoc(user.uid).catch(() => null);

  // لو مفيش doc لأول مرة
  if (!data) {
    await ensureUserDoc(user.uid, {
      role: "passenger",
      email: user.email || null,
      name: null,
      phone: null,
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
