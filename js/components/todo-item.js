/* ============================================
   todo-item.js — 单个待办事项渲染
   零依赖
   ============================================ */

import * as time from '../time.js';

/**
 * 创建单个事项的 DOM 元素
 * @param {Object} item - 事项数据
 * @returns {HTMLElement}
 */
export function createTodoItem(item) {
  const el = document.createElement('div');
  el.className = 'todo-item';
  el.dataset.id = item.id;

  // Status classes
  if (item.status === 'done') el.classList.add('status-done');
  if (item.pinned) el.classList.add('pinned');
  if (item.status === 'pending' && item.time && time.isOverdue(item.time)) {
    el.classList.add('overdue');
  }

  // Checkbox
  const check = document.createElement('div');
  check.className = 'item-check';
  check.dataset.action = 'toggleDone';
  if (item.status === 'done') {
    check.textContent = '✓';
    check.classList.add('done-mark');
  }

  // Info
  const info = document.createElement('div');
  info.className = 'item-info';

  const timeRow = document.createElement('div');
  if (item.time) {
    const timeSpan = document.createElement('span');
    timeSpan.className = 'item-time';
    timeSpan.textContent = time.formatTime(item.time);
    timeRow.appendChild(timeSpan);

    if (item.status === 'pending' && time.isOverdue(item.time)) {
      const overdueBadge = document.createElement('span');
      overdueBadge.className = 'overdue-label';
      overdueBadge.textContent = '⚠️ 已过期';
      timeRow.appendChild(overdueBadge);
    }
  } else {
    const timeSpan = document.createElement('span');
    timeSpan.className = 'item-time unscheduled';
    timeSpan.textContent = '⏳ 待排期';
    timeRow.appendChild(timeSpan);
  }

  const textEl = document.createElement('div');
  textEl.className = 'item-text';
  if (item.pinned) {
    const pinBadge = document.createElement('span');
    pinBadge.className = 'item-pin-badge';
    pinBadge.textContent = '📌';
    textEl.appendChild(pinBadge);
  }
  const textSpan = document.createElement('span');
  textSpan.textContent = item.text;
  textEl.appendChild(textSpan);

  info.appendChild(timeRow);
  info.appendChild(textEl);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const pinBtn = document.createElement('button');
  pinBtn.dataset.action = 'togglePin';
  pinBtn.textContent = item.pinned ? '📍' : '📌';
  pinBtn.title = item.pinned ? '取消置顶' : '置顶';

  const moreBtn = document.createElement('button');
  moreBtn.dataset.action = 'more';
  moreBtn.textContent = '⋯';
  moreBtn.title = '更多操作';

  actions.appendChild(pinBtn);
  actions.appendChild(moreBtn);

  el.appendChild(check);
  el.appendChild(info);
  el.appendChild(actions);

  return el;
}
