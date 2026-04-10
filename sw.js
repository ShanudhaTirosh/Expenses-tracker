// ============================================================
//  sw.js — ShanuFx Expense Tracker Service Worker (PWA)
// ============================================================

const CACHE = 'sfx-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/style.css',
  '/app.js',
  '/auth.js',
  '/firebase.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for Firebase API calls
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('firebaseio.com')) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
