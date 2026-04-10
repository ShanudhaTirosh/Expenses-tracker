// ============================================================
//  firebase.js — ShanuFx Expense Tracker
//  Replace the values below with your Firebase project config
// ============================================================

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAf4y1NTBfD9QKmBMzFYf01oMFpLb5G8no",
  authDomain: "shanufx-expense-traker.firebaseapp.com",
  projectId: "shanufx-expense-traker",
  storageBucket: "shanufx-expense-traker.firebasestorage.app",
  messagingSenderId: "91411129298",
  appId: "1:91411129298:web:0a56ec620642e9903a1e0b",
  measurementId: "G-NLW116CVF0"
};

// ── Init ──────────────────────────────────────────────────
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

// ── Optional: email whitelist ─────────────────────────────
// Leave empty [] to allow any manually-created Firebase user.
// Add emails here to restrict access to specific accounts only.
const ALLOWED_EMAILS = [];

export { auth, db, ALLOWED_EMAILS };
