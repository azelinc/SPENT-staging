const CACHE = 'spent-v88';
const FILES = [
  '/',
  '/index.html',
'/sp7.css?v=88',
'/sp7.js?v=88',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];
const FIREBASE_URLS = [
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js'
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return Promise.all([
        cache.addAll(FILES),
        ...FIREBASE_URLS.map(url =>
          cache.add(url).catch(() => {/* individual failure OK */})
        )
      ]);
    }).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  e.respondWith(
    fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||caches.match('/SPENT/')))
  );
});