/* ============================================
   scheduler.js — 智能排期器
   为无明确时间的事项自动分配提醒时间
   零依赖
   ============================================ */

/**
 * 为无时间事项建议一个提醒时间
 * @param {Array} items - 数据库中所有 pending 事项
 * @returns {number} 建议的时间戳
 */
export function suggestTime(items) {
  const now = Date.now();
  const todayEnd = getTodayEnd();
  const pending = items.filter(i => i.status === 'pending' && i.time !== null && i.time > now);

  // 收集今天已有事项的时间点
  const todayTimes = pending
    .filter(i => {
      const d = new Date(i.time);
      const today = new Date();
      return d.getFullYear() === today.getFullYear() &&
             d.getMonth() === today.getMonth() &&
             d.getDate() === today.getDate();
    })
    .map(i => i.time)
    .sort();

  // 策略：尽量分散排布，避免扎堆
  const baseSuggestions = [
    setTime(now, 10, 0),  // 今天 10:00
    setTime(now, 14, 0),  // 今天 14:00
    setTime(now, 16, 0),  // 今天 16:00
    setTime(now, 20, 0),  // 今天 20:00
  ];

  // 过滤掉已过去的时段
  const available = baseSuggestions.filter(t => t > now + 1800000); // 至少 30 分钟后

  // 找距离已有事项最远的时段
  let best = available[0];
  if (available.length > 1) {
    let maxDist = -1;
    for (const t of available) {
      let minDist = Infinity;
      for (const existing of todayTimes) {
        const dist = Math.abs(t - existing);
        if (dist < minDist) minDist = dist;
      }
      if (minDist > maxDist) {
        maxDist = minDist;
        best = t;
      }
    }
  }

  if (!best) {
    // 今天没合适时段 → 明天 10:00
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    best = tomorrow.getTime();
  }

  return best;
}

function getTodayEnd() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function setTime(from, hours, minutes) {
  const d = new Date(from);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}
