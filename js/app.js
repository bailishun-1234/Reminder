/* ============================================
   app.js — 主入口
   协调所有模块，实现完整交互闭环
   ============================================ */

import * as db from './db.js';
import * as time from './time.js';
import * as audio from './audio.js';
import * as reminder from './reminder.js';
import { suggestTime } from './scheduler.js';
import { renderList } from './components/todo-list.js';
import { showConfirmDialog } from './components/confirm-dialog.js';
import { showReminderDialog } from './components/reminder-dialog.js';
import { setupMicButton } from './components/mic-button.js';

// --- 全局状态 ---
let allItems = [];
let currentActionItemId = null;  // 操作表单当前选中项

// --- 初始化 ---
async function init() {
  try {
    // 加载数据
    allItems = await db.getAll();
    renderAll();

    // 时钟更新
    updateClock();
    setInterval(updateClock, 1000);
    updateNextReminder();
    setInterval(updateNextReminder, 10000);

    // 语音按钮
    setupMicButton(handleVoiceResult);

    // 提醒引擎
    reminder.start(handleReminder);

    // 列表点击事件（事件委托）
    document.getElementById('todoList').addEventListener('click', handleListClick);

    // 操作表单
    document.getElementById('actionCancel').addEventListener('click', hideActionSheet);
    document.querySelectorAll('#actionList button').forEach(btn => {
      btn.addEventListener('click', handleAction);
    });

    // 用户手势初始化音频（解决移动端 AudioContext 静默）
    const warmAudio = () => audio.initOnUserGesture();
    document.addEventListener('touchstart', warmAudio, { once: true });
    document.addEventListener('click', warmAudio, { once: true });
    // 每次提醒弹窗交互时也重新激活音频通道
    document.getElementById('remindSilent').addEventListener('click', warmAudio);
    document.getElementById('remindDone').addEventListener('click', warmAudio);
    document.getElementById('remindSnooze').addEventListener('click', warmAudio);

    // 请求通知权限（用于系统级提醒）
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // 刷新按钮
    document.getElementById('refreshBtn').addEventListener('click', () => {
      window.location.reload();
    });

    console.log('智能提醒器已启动');
  } catch (e) {
    console.error('初始化失败:', e);
  }
}

// --- 时钟 ---
function updateClock() {
  document.getElementById('clockDisplay').textContent = time.getClockString();
}

// --- 下一个提醒 ---
async function updateNextReminder() {
  try {
    const pending = await db.getPending();
    const now = Date.now();
    const next = pending
      .filter(i => i.time && i.time > now)
      .sort((a, b) => a.time - b.time)[0];

    const el = document.getElementById('nextReminder');
    if (next) {
      el.textContent = `下个提醒：${time.formatTime(next.time)}（${time.getTimeRemaining(next.time)}）`;
    } else {
      el.textContent = '下个提醒：--';
    }
  } catch (e) {
    // ignore
  }
}

// --- 渲染列表 ---
function renderAll() {
  renderList(document.getElementById('todoList'), allItems);
}

async function refreshList() {
  allItems = await db.getAll();
  renderAll();
}

// --- 语音/文本输入处理 ---
async function handleVoiceResult(rawText) {
  // 解析时间
  const parsed = time.parseTime(rawText);

  // 显示确认弹窗
  const result = await showConfirmDialog(rawText, parsed);
  if (!result.confirmed) return;

  const item = db.createItem(result.text, result.time, false);

  // 如果是待排期（无时间），自动分配时间
  if (!item.time) {
    const pending = await db.getPending();
    item.time = suggestTime(pending);
  }

  await db.add(item);
  await refreshList();
  updateNextReminder();
}

// --- 列表点击事件委托 ---
async function handleListClick(e) {
  const itemEl = e.target.closest('.todo-item');
  if (!itemEl) return;

  const id = itemEl.dataset.id;
  const action = e.target.dataset.action;

  if (action === 'toggleDone') {
    await toggleDone(id);
  } else if (action === 'togglePin') {
    await togglePin(id);
  } else if (action === 'more') {
    // 显示操作表单
    currentActionItemId = id;
    const item = allItems.find(i => i.id === id);
    if (item) {
      const titleEl = document.getElementById('actionSheetTitle');
      titleEl.textContent = item.text.length > 20 ? item.text.slice(0, 20) + '...' : item.text;
      // 更新置顶按钮文本
      const pinBtn = document.querySelector('#actionList [data-action="togglePin"]');
      pinBtn.textContent = item.pinned ? '📍 取消置顶' : '📌 置顶';
      document.getElementById('actionSheet').classList.remove('hidden');
    }
  } else if (!action) {
    // 点击事项本身 → 当作点击 more
    const moreBtn = itemEl.querySelector('[data-action="more"]');
    if (moreBtn) moreBtn.click();
  }
}

// --- 操作表单 ---
async function handleAction(e) {
  const action = e.currentTarget.dataset.action;
  const id = currentActionItemId;
  if (!id) return;

  hideActionSheet();

  switch (action) {
    case 'togglePin':
      await togglePin(id);
      break;
    case 'forward':
      await forwardItem(id);
      break;
    case 'snooze':
      await snoozeItem(id);
      break;
    case 'editTime':
      await editItemTime(id);
      break;
    case 'complete':
      await toggleDone(id);
      break;
    case 'delete':
      await deleteItem(id);
      break;
  }
}

function hideActionSheet() {
  document.getElementById('actionSheet').classList.add('hidden');
  currentActionItemId = null;
}

// --- 各项操作 ---

async function toggleDone(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  const newStatus = item.status === 'done' ? 'pending' : 'done';
  await db.update(id, { status: newStatus, remindCount: 0 });
  await refreshList();
}

async function togglePin(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  await db.update(id, { pinned: !item.pinned });
  await refreshList();
}

async function forwardItem(id) {
  const item = allItems.find(i => i.id === id);
  if (!item || !item.time) return;
  // 提前 1 小时（但不能早于现在 5 分钟）
  const newTime = Math.max(Date.now() + 300000, item.time - 3600000);
  await db.update(id, { time: newTime, remindCount: 0, lastRemindTime: null });
  await refreshList();
  updateNextReminder();
}

async function snoozeItem(id) {
  const item = allItems.find(i => i.id === id);
  if (!item || !item.time) return;
  // 延后 2 小时
  const newTime = item.time + 7200000;
  await db.update(id, { time: newTime, remindCount: 0, lastRemindTime: null });
  await refreshList();
  updateNextReminder();
}

async function editItemTime(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;

  // 直接用 confirmDialog 来修改时间
  const parsed = { time: item.time, text: item.text };
  const result = await showConfirmDialog(item.text, parsed);
  if (!result.confirmed) return;

  await db.update(id, {
    text: result.text,
    time: result.time,
    remindCount: 0,
    lastRemindTime: null
  });
  await refreshList();
  updateNextReminder();
}

async function deleteItem(id) {
  if (!confirm('确定要删除此事项吗？')) return;
  await db.remove(id);
  await refreshList();
  updateNextReminder();
}

// --- 系统通知（Android 可带声音和振动） ---
function sendNotification(item) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification('⏰ ' + item.text, {
      body: item.time ? time.formatTime(item.time) : '提醒时间到',
      tag: 'reminder-' + item.id,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 500],
      silent: false
    });
  } catch (e) { /* ignore */ }
}

// --- 提醒回调 ---
async function handleReminder(item, remindCount) {
  sendNotification(item);
  const result = await showReminderDialog(item, remindCount);

  switch (result.action) {
    case 'silent':
      await db.update(item.id, { remindCount: remindCount + 1, lastRemindTime: Date.now() });
      break;

    case 'done':
      audio.stopAll();
      reminder.stopFlash();
      await db.update(item.id, {
        status: 'done',
        remindCount: 0,
        lastRemindTime: null
      });
      await refreshList();
      break;

    case 'snooze':
      audio.stopAll();
      reminder.stopFlash();
      const snoozeMap = {
        '15min': 15 * 60 * 1000,
        '1h': 3600000,
        'tonight': getTonightOffset(),
        'tomorrow': getTomorrowOffset(),
        'weekend': getWeekendOffset(),
      };
      const offset = snoozeMap[result.snoozeTarget] || 3600000;
      const snoozeUntil = Date.now() + offset;
      await db.update(item.id, {
        snoozeUntil,
        remindCount: 0,
        lastRemindTime: null
      });
      if (result.snoozeTarget === 'tomorrow' || result.snoozeTarget === 'weekend') {
        await db.update(item.id, { time: snoozeUntil });
      }
      await refreshList();
      updateNextReminder();
      break;
  }

  reminder.markHandled();
}

function getTonightOffset() {
  const now = new Date();
  const tonight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0);
  if (tonight.getTime() <= now.getTime()) {
    tonight.setDate(tonight.getDate() + 1);
  }
  return tonight.getTime() - now.getTime();
}

function getTomorrowOffset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
}

function getWeekendOffset() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const daysUntilWeekend = (6 - day + 7) % 7 || 7; // next Saturday
  const weekend = new Date(now);
  weekend.setDate(weekend.getDate() + daysUntilWeekend);
  weekend.setHours(10, 0, 0, 0);
  return weekend.getTime() - now.getTime();
}

// --- 启动 ---
document.addEventListener('DOMContentLoaded', init);

// 注册 Service Worker（系统通知唤醒、离线缓存）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
