/* ============================================
   sw.js — Service Worker
   网络优先缓存 + 独立后台提醒检查 + 通知唤醒
   ============================================ */

const CACHE = 'reminder-v4';
const DB = 'ReminderDB';
const STORE = 'items';
const CHECK_INTERVAL = 15000; // 15 秒检查一次（后台仍会降频但比页面可靠）

// ====== IndexedDB 工具（SW 独立读取） ======

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getDueItems() {
  const now = Date.now();
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const all = await new Promise((res, rej) => {
    const r = store.getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  db.close();
  return (all || []).filter(item => {
    if (!item.time) return false;
    if (item.status === 'done') return false;
    if (item.snoozeUntil && item.snoozeUntil > now) return false;
    if (item.lastRemindTime && (now - item.lastRemindTime < 30000)) return false;
    return item.time <= now;
  });
}

// ====== 后台轮询 ======

let checkTimer = null;

function startBackgroundCheck() {
  if (checkTimer) return;
  checkTimer = setInterval(async () => {
    try {
      const items = await getDueItems();
      for (const item of items) {
        showNotification(item);
        break; // 一次只提醒一个
      }
    } catch (e) {
      // SW 静默失败
    }
  }, CHECK_INTERVAL);
}

function stopBackgroundCheck() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

function showNotification(item) {
  const timeStr = item.time
    ? new Date(item.time).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '提醒时间到';
  self.registration.showNotification('⏰ ' + item.text, {
    body: timeStr,
    tag: 'reminder-' + item.id,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 500]
  });
  // 更新数据库，避免每 15 秒重复弹通知
  updateReminderAfterNotify(item.id);
}

async function updateReminderAfterNotify(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const data = await new Promise((res, rej) => {
      const r = store.get(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (data) {
      data.lastRemindTime = Date.now();
      data.remindCount = (data.remindCount || 0) + 1;
      store.put(data);
    }
    tx.oncomplete = () => db.close();
  } catch (e) {
    // SW 静默失败
  }
}

// ====== 生命周期 ======

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)))
    ).then(() => {
      self.clients.claim();
      // 通知所有窗口：新版本已激活，请刷新
      self.clients.matchAll().then(cls => {
        cls.forEach(c => c.postMessage({ type: 'NEW_VERSION' }));
      });
    })
  );
  // 激活后立即开始后台检查
  startBackgroundCheck();
});

// 有客户端连接时开始检查，全部断开时停止
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REMINDER') {
    const item = event.data.item;
    showNotification(item);
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 客户端连接状态变化
self.addEventListener('connect', () => startBackgroundCheck());

// 点击通知 → 聚焦或打开应用
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        return clients.openWindow('/');
      })
  );
});

// ====== 缓存策略 ======

self.addEventListener('fetch', (event) => {
  // HTML 始终走网络（不缓存），确保每次打开都是最新版本
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  // 其他资源：网络优先，缓存作为后备
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
