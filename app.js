// app.js — FINAL v13 (Fix login/signup logic + role helpers) — Mashwarak
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
  storageBucket: "meshwark-8adf8.appspot.com",
  messagingSenderId: "450060838946",
  appId: "1:450060838946:web:963cacdd125b253fa1827b",
};

// ========= init
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ خلي الجلسة تفضل محفوظة
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

  if (/^[^@]+@$/.test(x)) return x + "meshwarak.local";
  return x;
}

export function normalizePassword(input) {
  const x = String(input || "").trim();
  return x.length >= 6 ? x : null;
}

// ✅ Phone normalization
export function normalizePhone(input) {
  let x = String(input || "").trim();
  if (!x) return null;

  const map = { "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9" };
  x = x.replace(/[٠-٩]/g, (d) => map[d] ?? d);

  x = x.replace(/[^\d+]/g, "");

  if (x.includes("+")) {
    x = "+" + x.replace(/\+/g, "");
  }

  if (x.startsWith("00")) x = "+" + x.slice(2);

  if (/^01\d{9}$/.test(x)) x = "+20" + x;
  if (/^201\d{9}$/.test(x)) x = "+20" + x.slice(2);

  if (x.startsWith("+")) {
    const digits = x.slice(1);
    if (!/^\d{8,15}$/.test(digits)) return null;
    return "+" + digits;
  }

  if (!/^\d{8,15}$/.test(x)) return null;
  return x;
}

export function formatPhoneForDisplay(phone) {
  const p = String(phone || "").trim();
  return p || "-";
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

// ✅ تغيير الدور بسرعة (مفيد لصفحة login)
export async function setUserRole(uid, role) {
  if (role !== "passenger" && role !== "driver") throw new Error("bad-role");
  await saveUserProfile(uid, { role });
  return role;
}

// ✅ تحديث رقم الهاتف فقط
export async function setUserPhone(uid, phoneRaw) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) throw new Error("bad-phone");
  await saveUserProfile(uid, { phone });
  return phone;
}

// ========= ✅ Auto Login: signIn else createUser
// ✅ FIX: متعملش Signup لو الباسورد غلط (ده كان سبب auth/email-already-in-use)
export async function emailLoginOrSignup(emailRaw, passRaw) {
  const email = normalizeEmail(emailRaw);
  const password = normalizePassword(passRaw);

  if (!email) throw new Error("bad-email");
  if (!password) throw new Error("bad-pass");

  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    const code = e?.code || "";

    // الحساب مش موجود -> Signup
    if (code === "auth/user-not-found") {
      return await createUserWithEmailAndPassword(auth, email, password);
    }

    // في بعض الحالات Firebase بيرجع invalid-credential للحساب اللي مش موجود
    // نجرب Signup مرة واحدة، ولو طلع email-already-in-use يبقى المشكلة كلمة مرور غلط
    if (code === "auth/invalid-credential") {
      try {
        return await createUserWithEmailAndPassword(auth, email, password);
      } catch (e2) {
        if (e2?.code === "auth/email-already-in-use") {
          // رجّع نفس خطأ تسجيل الدخول (يعني الباسورد غلط)
          throw e;
        }
        throw e2;
      }
    }

    // أي حاجة تانية (wrong-password / invalid-login-credentials ...) -> رجّع الخطأ زي ما هو
    throw e;
  }
}

// ========= auth guard
export async function requireAuthAndRole(requiredRole = null) {
  const user = await new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => { unsub(); resolve(u); },
      (err) => { unsub(); reject(err); }
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
