/* ============================================
   sw.js — 自销毁 Service Worker
   清除所有缓存并注销自身
   ============================================ */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then(clients => clients.forEach(c => {
        if (c.url && !c.url.includes('sw.js')) {
          c.navigate(c.url);
        }
      }))
  );
});
