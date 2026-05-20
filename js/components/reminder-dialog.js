/* ============================================
   reminder-dialog.js — 提醒弹窗
   零依赖
   ============================================ */

import * as time from '../time.js';
import * as audio from '../audio.js';

let currentItem = null;
let currentRemindCount = 0;
let resolveCurrent = null;

/**
 * 显示提醒弹窗
 * @param {Object} item - 事项数据
 * @param {number} remindCount - 当前第几次提醒
 * @returns {Promise<{action: string, snoozeTarget?: string|null}>}
 *   action: 'silent' | 'done' | 'snooze'
 */
export function showReminderDialog(item, remindCount) {
  // 每次弹提醒时请求通知权限（用户手势上下文中）
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  return new Promise((resolve) => {
    currentItem = item;
    currentRemindCount = remindCount;
    resolveCurrent = resolve;

    const overlay = document.getElementById('reminderDialog');
    const textEl = document.getElementById('reminderText');
    const timeEl = document.getElementById('reminderTime');
    const silentBtn = document.getElementById('remindSilent');
    const doneBtn = document.getElementById('remindDone');
    const snoozeBtn = document.getElementById('remindSnooze');
    const snoozeOptions = document.getElementById('snoozeOptions');

    textEl.textContent = item.text;
    timeEl.textContent = item.time ? time.formatTime(item.time) : '';

    // Reset snooze options visibility
    snoozeOptions.classList.add('hidden');

    overlay.classList.remove('hidden');

    // 静音
    silentBtn.onclick = () => {
      audio.stopAll();
      closeDialog();
      resolve({ action: 'silent' });
    };

    // 完成
    doneBtn.onclick = () => {
      audio.stopAll();
      closeDialog();
      resolve({ action: 'done' });
    };

    // 延后（展开选项）
    snoozeBtn.onclick = () => {
      snoozeOptions.classList.toggle('hidden');
    };

    // 延后选项
    snoozeOptions.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        audio.stopAll();
        closeDialog();
        resolve({ action: 'snooze', snoozeTarget: btn.dataset.snooze });
      };
    });
  });
}

function closeDialog() {
  document.getElementById('reminderDialog').classList.add('hidden');
  currentItem = null;
  resolveCurrent = null;
}

/**
 * 获取当前正在提醒的事项（用于外部判断）
 */
export function getCurrentReminder() {
  return currentItem;
}
