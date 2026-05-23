const CACHE = 'spent-v16';
const FILES = [
  '/SPENT/',
  '/SPENT/index.html',
  '/SPENT/sp6.css',
  '/SPENT/sp6.js',
  '/SPENT/manifest.json',
  '/SPENT/icon-192.png',
  '/SPENT/icon-512.png'
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