const CACHE = 'setlist-v2';
const STATIC_ASSETS = [
  './index.html',
  './script.js',
  './style.css',
  './manifest.json',
  './icons/icon.svg'
];

// --- Install: pre-cache static shell ---
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// --- Activate: delete old caches ---
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// --- Fetch: serve from cache, fall back to network ---
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Let Firebase, Google Fonts, and CDN requests bypass the cache entirely
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // Network-first for the HTML shell so updates land quickly
      if (!cached || url.pathname.endsWith('.html') || url.pathname === '/') {
        return fetch(e.request)
          .then(res => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then(c => c.put(e.request, copy));
            }
            return res;
          })
          .catch(() => cached); // offline fallback
      }
      // Cache-first for JS/CSS/icons
      return cached;
    })
  );
});
