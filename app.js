// app.js (FINAL) — Phone Auth + Firestore helpers
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ✅ Firebase config (زي ما هو عندك)
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ========= utils
export function qs(key) {
  const u = new URL(location.href);
  return u.searchParams.get(key);
}

export function normalizeEgyptPhone(input) {
  let x = String(input || "").trim();

  // remove spaces/dashes
  x = x.replace(/[^\d+]/g, "");

  // 01xxxxxxxxx
  if (/^01\d{9}$/.test(x)) return "+20" + x.substring(1);

  // 201xxxxxxxxx
  if (/^20\d{10}$/.test(x)) return "+" + x;

  // +201xxxxxxxxx
  if (/^\+20\d{10}$/.test(x)) return x;

  return null;
}

// ========= Phone Login (OTP)
export async function startPhoneLogin(phoneE164, recaptchaContainerId = "recaptcha") {
  // لازم يبقى في <div id="recaptcha"></div> في login.html
  if (!window.__mw_recaptchaVerifier) {
    window.__mw_recaptchaVerifier = new RecaptchaVerifier(
      auth,
      recaptchaContainerId,
      {
        size: "invisible",
      }
    );
  } else {
    try {
      // لو اتعمل قبل كده
      window.__mw_recaptchaVerifier.clear();
    } catch {}
    window.__mw_recaptchaVerifier = new RecaptchaVerifier(
      auth,
      recaptchaContainerId,
      { size: "invisible" }
    );
  }

  const appVerifier = window.__mw_recaptchaVerifier;
  const confirmation = await signInWithPhoneNumber(auth, phoneE164, appVerifier);
  // login.html هيكمل بـ confirmation.confirm(code)
  return confirmation;
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

  const data = await getUserDoc(user.uid).catch(() => null);

  // لو لسه مفيش users doc (مثلاً أول مرة بعد OTP)
  if (!data) {
    await ensureUserDoc(user.uid, {
      role: "passenger",
      phone: user.phoneNumber || null,
      email: user.email || null,
      name: null,
    });
  }

  const fresh = (await getUserDoc(user.uid).catch(() => null)) || data || {};
  const role = fresh.role || null;

  if (requiredRole && role !== requiredRole) {
    location.href = "./index.html";
    throw new Error("wrong role");
  }

  return { user, data: fresh };
}

export async function doLogout() {
  await signOut(auth);
  location.href = "./login.html";
}
