// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ✅ Firebase Config (من عندك)
const firebaseConfig = {
  apiKey: "AIzaSyDA9pP-Y3PEvl6675f4pHDyXzayzzmihhI",
  authDomain: "meshwark-8adf8.firebaseapp.com",
  projectId: "meshwark-8adf8",
  storageBucket: "meshwark-8adf8.firebasestorage.app",
  messagingSenderId: "450060838946",
  appId: "1:450060838946:web:963cacdd125b253fa1827b",
  measurementId: "G-GP0JGBZTGG"
};

// ✅ Init
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ يضمن إن المستخدم مسجل دخول + دوره صحيح من users/{uid}.role
export async function requireAuthAndRole(requiredRole) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // لو مش مسجل دخول، ودّيه لصفحة تسجيل الدخول عندك (غير الاسم لو مختلف)
        window.location.href = "./login.html";
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? snap.data() : null;
        const role = data?.role || null;

        if (requiredRole && role !== requiredRole) {
          alert("❌ ليس لديك صلاحية لفتح الصفحة.");
          window.location.href = "./";
          return;
        }

        resolve({ user, userData: data });
      } catch (e) {
        console.error(e);
        alert("❌ خطأ في قراءة بيانات المستخدم من Firestore.");
        window.location.href = "./login.html";
      }
    });
  });
}
