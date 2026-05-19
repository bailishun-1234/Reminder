/* ============================================
   sw.js — Service Worker
   网络优先策略缓存 + 系统通知唤醒
   ============================================ */

const CACHE = 'reminder-v3';

// 网络优先：从网络获取，失败则用缓存
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// 安装：跳过等待
self.addEventListener('install', () => {
  self.skipWaiting();
});

// 激活：清理旧缓存，接管所有客户端
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// 收到页面消息 → 显示系统通知
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'REMINDER') return;
  const item = event.data.item;
  self.registration.showNotification('⏰ ' + item.text, {
    body: item.time ? new Date(item.time).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '提醒时间到',
    tag: 'reminder-' + item.id,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 500],
    icon: '/images/icons/icon-192.svg',
    badge: '/images/icons/icon-192.svg'
  });
});

// 点击通知 → 聚焦或打开应用
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // 有已打开的窗口则聚焦
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        // 否则打开新窗口
        return clients.openWindow('/');
      })
  );
});
