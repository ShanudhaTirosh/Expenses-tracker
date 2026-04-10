# 💳 ShanuFx Expense Tracker

A premium, private full-stack expense tracker with glassmorphism UI, neon accents, GSAP animations, and Firebase backend.

---

## 📁 Project Files

```
expense-tracker/
├── index.html      ← Main dashboard (all pages)
├── login.html      ← Login page (no public signup)
├── style.css       ← Glassmorphism + neon theme
├── app.js          ← Main logic (charts, Firestore, UI)
├── auth.js         ← Firebase Auth helpers
├── firebase.js     ← 🔧 YOUR CONFIG GOES HERE
└── sw.js           ← Service Worker (PWA/offline)
```

---

## ⚙️ Firebase Setup

### 1. Create Firebase Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `shanufx-expenses`)
3. Disable Google Analytics (optional) → **Create project**

### 2. Enable Authentication
1. Go to **Build → Authentication → Get started**
2. Enable **Email/Password** provider
3. Go to **Users** tab → **Add user**
4. Add your email + password manually
5. ❌ Do NOT enable any self-signup options

### 3. Enable Firestore
1. Go to **Build → Firestore Database → Create database**
2. Choose **Production mode**
3. Pick a region close to Sri Lanka (e.g. `asia-south1`)

### 4. Add Security Rules
In Firestore → **Rules**, paste:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 5. Get Config
1. Go to **Project Settings** (gear icon) → **General**
2. Scroll to **Your apps** → **Web** → Register app
3. Copy the `firebaseConfig` object

---

## 🔧 Configuration

Open `firebase.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123...:web:abc..."
};
```

### Optional: Email Whitelist
In `firebase.js`, add allowed emails:
```javascript
const ALLOWED_EMAILS = ["you@example.com", "partner@example.com"];
```
Leave as `[]` to allow any manually-created Firebase user.

---

## 🚀 Running Locally

### Option A: VS Code Live Server
1. Install the **Live Server** extension
2. Right-click `index.html` → **Open with Live Server**
3. App runs at `http://127.0.0.1:5500`

### Option B: Python HTTP Server
```bash
cd expense-tracker
python -m http.server 8080
# Open http://localhost:8080
```

### Option C: Node serve
```bash
npx serve .
```

> ⚠️ Must be served over HTTP (not opened as a file) for Firebase to work.

---

## 🌐 Deployment

### Netlify (recommended — free)
1. Go to [netlify.com](https://netlify.com) → **Add new site → Deploy manually**
2. Drag and drop the `expense-tracker/` folder
3. Done! You get a `*.netlify.app` URL

### Vercel
```bash
npm i -g vercel
cd expense-tracker
vercel
```

### Firebase Hosting
```bash
npm i -g firebase-tools
firebase login
firebase init hosting   # select your project, public dir = .
firebase deploy
```

---

## 🎯 Features Summary

| Feature | Details |
|---|---|
| Auth | Firebase Email/Password, no public signup |
| Dashboard | Balance, income, expense cards with animated counters |
| Charts | Pie (by category) + Line (6-month trend) via Chart.js |
| Budget | Monthly budget with animated progress bar + warnings |
| Smart Insights | Auto-generated spending insights (month-over-month, top categories) |
| Transactions | Add, edit, delete with real-time Firestore sync |
| Filtering | Search, type, category, date range filters |
| Export | One-click CSV export |
| Theme | Dark / Light glass toggle (persisted) |
| Animations | GSAP: page load, counters, list stagger, modal transitions |
| Shortcuts | `A` add, `D` dashboard, `T` transactions, `R` reports, `S` settings |
| PWA | Offline support via Service Worker |
| Responsive | Mobile + tablet + desktop |

---

## 🗄️ Firestore Schema

```
users (collection)
└── {userId} (document)
    ├── budget: number
    └── transactions (subcollection)
        └── {txnId}
            ├── amount:    number
            ├── type:      "income" | "expense"
            ├── category:  string
            ├── date:      "YYYY-MM-DD"
            ├── note:      string
            └── createdAt: Timestamp
```

---

## 🎨 Design System

- **Font**: Outfit (UI) + JetBrains Mono (numbers)
- **Colors**: `#00ffcc` neon green · `#f5e642` yellow · `#ff4d6d` red · `#4d9fff` blue
- **Glass**: `backdrop-filter: blur(16px)` with `rgba(255,255,255,0.04)` background
- **Background**: Animated radial gradient mesh on `#06060f`

---

Made with ❤️ by **Shanudha Tirosh** · ShanuFx Brand
