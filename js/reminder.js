/* ============================================
   reminder.js — 提醒引擎
   每秒轮询检查到期事项，分级触发提醒
   零依赖
   ============================================ */

import * as db from './db.js';
import * as audio from './audio.js';

let intervalId = null;
let onRemind = null;
let continuousStopFn = null;
let isReminding = false;  // 防止并发提醒
let pendingReminder = null; // 后台触发时暂存，等页面可见时再弹
let onVisibilityChange = null; // 可见性恢复时回调
const CHECK_INTERVAL = 1000;

/**
 * 启动提醒引擎
 * @param {Function} remindCallback - 触发提醒时的回调 (item, count) => void
 */
export function start(remindCallback) {
  onRemind = remindCallback;
  if (intervalId) return;
  intervalId = setInterval(check, CHECK_INTERVAL);
}

/**
 * 停止提醒引擎
 */
export function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  audio.stopAll();
}

async function check() {
  if (isReminding) return; // 已有提醒弹窗，暂不检查

  try {
    const now = Date.now();
    const items = await db.getPending();

    for (const item of items) {
      if (!item.time) continue;
      if (item.snoozeUntil && item.snoozeUntil > now) continue;
      if (item.lastRemindTime && (now - item.lastRemindTime < 30000)) continue;

      if (item.time <= now) {
        triggerReminder(item);
        break; // 一次只触发一个提醒
      }
    }
  } catch (e) {
    console.error('Reminder check error:', e);
  }
}

function triggerReminder(item) {
  const count = item.remindCount || 0;
  isReminding = true;

  // 更新提醒计数和最后提醒时间（不等待完成）
  db.update(item.id, {
    remindCount: count + 1,
    lastRemindTime: Date.now()
  });

  if (continuousStopFn) {
    continuousStopFn();
    continuousStopFn = null;
  }

  // 页面不可见（其他应用打开）：只发 SW 通知，不弹窗不响铃，等页面恢复时再弹
  if (document.hidden) {
    pendingReminder = { item, count };
    notifySW(item);
    // 页面直接发通知（SW 可能被浏览器终止）
    notifyPageNotification(item);
    return;
  }

  // 页面可见：触发铃声/震动
  if (count === 0) {
    audio.playSingle();
  } else if (count === 1) {
    audio.playTriple();
  } else {
    continuousStopFn = audio.playContinuous();
  }

  // 发送通知到 Service Worker（后台也能弹系统通知）
  notifySW(item);

  if (onRemind) {
    onRemind(item, count);
  }

  flashTitle(item.text);
}

/** 通知 Service Worker 弹出系统通知 */
function notifySW(item) {
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type: 'REMINDER',
    item: { id: item.id, text: item.text, time: item.time }
  });
}

/** 页面直接发系统通知（后备，SW 可能被终止） */
function notifyPageNotification(item) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification('⏰ ' + item.text, {
      body: item.time ? new Date(item.time).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '提醒时间到',
      tag: 'reminder-' + item.id,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 500],
      silent: false
    });
  } catch (e) { /* ignore */ }
}

/** 标记提醒已处理，允许下个提醒触发 */
export function markHandled() {
  isReminding = false;
}

/** 获取后台触发的待弹窗提醒 */
export function getPendingReminder() {
  return pendingReminder;
}

/** 清除后台触发的待弹窗提醒 */
export function clearPendingReminder() {
  pendingReminder = null;
}

/** 注册可见性恢复回调（由 app.js 设置） */
export function onVisibilityChanged(callback) {
  onVisibilityChange = callback;
}

// 监听页面恢复可见，触发暂存的提醒
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && pendingReminder) {
    const pr = pendingReminder;
    pendingReminder = null;
    if (onVisibilityChange) {
      onVisibilityChange(pr.item, pr.count);
    }
  }
});

let flashInterval = null;

function flashTitle(text) {
  const original = document.title;
  let toggle = false;
  if (flashInterval) clearInterval(flashInterval);
  flashInterval = setInterval(() => {
    toggle = !toggle;
    document.title = toggle ? `⏰ ${text}` : original;
  }, 800);
  setTimeout(() => {
    if (flashInterval) {
      clearInterval(flashInterval);
      flashInterval = null;
    }
    document.title = original;
  }, 5000);
}

export function stopFlash() {
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
  }
}

export function stopContinuousAlarm() {
  if (continuousStopFn) {
    continuousStopFn();
    continuousStopFn = null;
  }
  audio.stopAll();
}
