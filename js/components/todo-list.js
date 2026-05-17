/* ============================================
   todo-list.js — 待办列表渲染（分组排序）
   零依赖
   ============================================ */

import * as time from '../time.js';
import { createTodoItem } from './todo-item.js';

/**
 * 渲染待办列表
 * @param {HTMLElement} container - 列表容器
 * @param {Array} items - 事项数据数组
 */
export function renderList(container, items) {
  container.innerHTML = '';

  if (!items || items.length === 0) {
    document.getElementById('emptyState').classList.remove('hidden');
    return;
  }
  document.getElementById('emptyState').classList.add('hidden');

  // 分组
  const groups = {};
  for (const item of items) {
    if (item.status === 'done') {
      // 已完成项放入单独组或跳过
      if (!groups['done']) groups['done'] = [];
      groups['done'].push(item);
      continue;
    }
    let group;
    if (item.pinned) {
      group = 'pinned';
    } else {
      group = time.getDateGroup(item.time);
    }
    if (!groups[group]) groups[group] = [];
    groups[group].push(item);
  }

  // 排序组
  const sortedGroups = Object.keys(groups).sort((a, b) => time.getGroupOrder(a) - time.getGroupOrder(b));

  for (const groupKey of sortedGroups) {
    const groupItems = groups[groupKey];
    if (groupItems.length === 0) continue;

    // Group header
    if (groupKey !== 'pinned') {
      const header = document.createElement('div');
      header.className = 'list-group-header';
      header.textContent = time.getGroupLabel(groupKey);
      const count = document.createElement('span');
      count.className = 'group-count';
      count.textContent = `${groupItems.length} 项`;
      header.appendChild(count);
      container.appendChild(header);
    }

    // Sort items within group
    if (groupKey === 'pinned') {
      // Pinned items: newest first (or by time)
      groupItems.sort((a, b) => (a.time || 0) - (b.time || 0));
    } else {
      groupItems.sort((a, b) => (a.time || 0) - (b.time || 0));
    }

    // Render each item
    for (const item of groupItems) {
      container.appendChild(createTodoItem(item));
    }
  }
}
