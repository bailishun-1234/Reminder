/* ============================================
   db.js — IndexedDB 封装
   零依赖，Promise-based CRUD
   ============================================ */

const DB_NAME = 'ReminderDB';
const DB_VERSION = 1;
const STORE_NAME = 'items';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('time', 'time', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('pinned', 'pinned', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function getStore(db, mode = 'readonly') {
  const tx = db.transaction(STORE_NAME, mode);
  return tx.objectStore(STORE_NAME);
}

/* --- CRUD API --- */

export async function getAll() {
  const db = await openDB();
  const store = getStore(db);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result;
      items.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        if (a.time && b.time) return a.time - b.time;
        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;
        return b.createdAt - a.createdAt;
      });
      resolve(items);
    };
    req.onerror = () => reject(req.error);
    db.close();
  });
}

export async function getPending() {
  const db = await openDB();
  const store = getStore(db);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result.filter(i => i.status === 'pending');
      items.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        if (a.time && b.time) return a.time - b.time;
        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;
        return b.createdAt - a.createdAt;
      });
      resolve(items);
    };
    req.onerror = () => reject(req.error);
    db.close();
  });
}

export async function add(item) {
  const db = await openDB();
  const store = getStore(db, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.add(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
    db.close();
  });
}

export async function update(id, data) {
  const db = await openDB();
  const store = getStore(db, 'readwrite');
  return new Promise((resolve, reject) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) { reject(new Error('Item not found')); return; }
      Object.assign(item, data, { updatedAt: Date.now() });
      const putReq = store.put(item);
      putReq.onsuccess = () => resolve(item);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
    db.close();
  });
}

export async function remove(id) {
  const db = await openDB();
  const store = getStore(db, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    db.close();
  });
}

export function createItem(text, time, pinned = false) {
  return {
    id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    text: text.trim(),
    time: time,        // timestamp or null
    status: 'pending', // 'pending' | 'done' | 'archived'
    pinned,
    remindCount: 0,
    lastRemindTime: null,
    snoozeUntil: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sortOrder: Date.now()
  };
}
