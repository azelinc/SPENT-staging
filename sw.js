const CACHE = 'spent-v26';
const FILES = [
  '/SPENT-staging/',
  '/SPENT-staging/index.html',
  '/SPENT-staging/sp7.css',
  '/SPENT-staging/sp7.js',
  '/SPENT-staging/manifest.json',
  '/SPENT-staging/icon-192.png',
  '/SPENT-staging/icon-512.png'
];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).catch(()=>caches.match('/SPENT/'))));
});