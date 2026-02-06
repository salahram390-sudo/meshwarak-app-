// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
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

// 🔥 Firebase config (بتاعك)
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
export function normalizeEgyptPhone(input) {
  let x = (input || "").trim();
  x = x.replace(/\s+/g, "");
  x = x.replace(/-/g, "");

  // لو بدأ بـ 0 (010...) نخليه +20
  if (x.startsWith("0")) x = "+20" + x.slice(1);

  // لو بدأ بـ 20 نخليه +20
  if (x.startsWith("20")) x = "+20" + x.slice(2);

  // لو بدأ بـ +20 تمام
  if (!x.startsWith("+")) {
    // آخر حل: لو كتب 10 ارقام
    if (x.length === 10 || x.length === 11) {
      if (x.startsWith("0")) x = "+20" + x.slice(1);
      else x = "+20" + x;
    }
  }
  return x;
}

export async function saveUserRole(uid, role) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, {
    role,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function saveUserProfile(uid, data) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export function requireAuthAndRole(requiredRole) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        location.href = "login.html";
        return;
      }
      const data = await getUserDoc(user.uid);

      // لو لسه ما اختارش role
      if (!data?.role) {
        location.href = "login.html";
        return;
      }

      if (requiredRole && data.role !== requiredRole) {
        // لو راكب دخل صفحة سائق أو العكس
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

// =========================
// Phone Auth (OTP)
// =========================
export function setupRecaptcha(containerId) {
  // لازم containerId يكون موجود في الصفحة
  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "normal",
  });
  return window.recaptchaVerifier;
}

export async function sendOTP(phone) {
  const appVerifier = window.recaptchaVerifier;
  return await signInWithPhoneNumber(auth, phone, appVerifier);
}
