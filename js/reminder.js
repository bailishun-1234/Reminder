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

  if (count === 0) {
    audio.playSingle();
  } else if (count === 1) {
    audio.playTriple();
  } else {
    continuousStopFn = audio.playContinuous();
  }

  if (onRemind) {
    onRemind(item, count);
  }

  flashTitle(item.text);
}

/** 标记提醒已处理，允许下个提醒触发 */
export function markHandled() {
  isReminding = false;
}

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
