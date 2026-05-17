/* ============================================
   time.js — 自然语言时间解析 & 格式化工具
   零依赖
   ============================================ */

/**
 * 从文本中提取时间，返回 { time, text }
 * time: Date.parse 时间戳 | null（无明确时间）
 * text: 去除时间短语后的纯事项文本
 */
export function parseTime(input) {
  let text = input.trim();
  if (!text) return { time: null, text: '' };

  let year = null, month = null, day = null;
  let hour = null, minute = null;
  let relativeMinutes = null;
  let matched = false;

  // ----- 1. 相对时间: "X分钟后" / "X小时后" -----
  const relMatch = text.match(/(\d+)\s*(分钟|小时)\s*(后|之后)/);
  if (relMatch) {
    const val = parseInt(relMatch[1]);
    const unit = relMatch[2];
    relativeMinutes = unit === '小时' ? val * 60 : val;
    text = text.replace(relMatch[0], '').replace(/提醒我|提醒/g, '').trim();
    matched = true;
  }

  // ----- 2. 日期关键词 -----
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // "大后天" = +3, "后天" = +2, "明天" = +1, "今天" / "今晚" = 0
  const dayMap = {
    '大后天': 3, '后天': 2, '明天': 1, '今天': 0, '今晚': 0,
    '周一': null, '周二': null, '周三': null, '周四': null,
    '周五': null, '周六': null, '周日': null,
    '星期一': null, '星期二': null, '星期三': null, '星期四': null,
    '星期五': null, '星期六': null, '星期日': null,
    '周1': null, '周2': null, '周3': null, '周4': null,
    '周5': null, '周6': null, '周7': null,
  };
  // Map Chinese day names to JS getDay() values (0=Sunday)
  const chineseToJsDay = {
    '周日': 0, '周七': 0, '星期日': 0,
    '周一': 1, '星期一': 1, '周1': 1,
    '周二': 2, '星期二': 2, '周2': 2,
    '周三': 3, '星期三': 3, '周3': 3,
    '周四': 4, '星期四': 4, '周4': 4,
    '周五': 5, '星期五': 5, '周5': 5,
    '周六': 6, '星期六': 6, '周6': 6,
    '周七': 0, '周日': 0,
  };

  let dayOffset = null;

  // Check "大后天" / "后天" / "明天" / "今天" / "今晚"
  for (const [kw, offset] of Object.entries(dayMap)) {
    if (offset !== null && text.includes(kw)) {
      dayOffset = offset;
      text = text.replace(kw, '');
      break;
    }
  }

  // Check weekday references like "周一", "星期二", etc.
  if (dayOffset === null) {
    for (const [kw, _] of Object.entries(chineseToJsDay)) {
      if (text.includes(kw)) {
        const targetDay = chineseToJsDay[kw];
        const currentDay = now.getDay();
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7; // next week if today has passed or is today
        dayOffset = diff;
        text = text.replace(kw, '');
        break;
      }
    }
  }

  if (dayOffset !== null) {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    year = d.getFullYear();
    month = d.getMonth();
    day = d.getDate();
  }

  // ----- 3. 时间段关键词（默认时间） -----
  const periodMap = {
    '早上': 7, '早晨': 7, '晨': 7,
    '上午': 9,
    '中午': 12, '午': 12,
    '下午': 15,
    '晚上': 20, '夜晚': 20, '晚间': 20,
    '半夜': 0, '午夜': 0, '凌晨': 1,
  };
  let periodHour = null;
  for (const [kw, h] of Object.entries(periodMap)) {
    if (text.includes(kw)) {
      periodHour = h;
      text = text.replace(kw, '');
      break;
    }
  }

  // ----- 4. 具体时间: "X点[X分]" / "X:X" -----
  const timePatterns = [
    // "3点" / "15点" / "3点半" / "3点30分" / "3:30"
    { re: /(\d{1,2})[：:](\d{2})\s*(?:分)?/, parse: (m) => { hour = parseInt(m[1]); minute = parseInt(m[2]); } },
    { re: /(\d{1,2})\s*点\s*(\d{1,2})\s*分/, parse: (m) => { hour = parseInt(m[1]); minute = parseInt(m[2]); } },
    { re: /(\d{1,2})\s*点\s*半/, parse: (m) => { hour = parseInt(m[1]); minute = 30; } },
    { re: /(\d{1,2})\s*点(?!\d)/, parse: (m) => { hour = parseInt(m[1]); minute = 0; } },
  ];

  for (const pattern of timePatterns) {
    const m = text.match(pattern.re);
    if (m) {
      pattern.parse(m);
      text = text.replace(m[0], '');
      matched = true;
      break;
    }
  }

  // Hour adjustment for 12-hour format without period
  // If hour is 1-6 and no period specified, assume PM (afternoon)
  // Actually, this is tricky. Let's just use the value as-is unless a period was specified.

  // ----- 5. 构建时间 -----
  let time = null;
  if (relativeMinutes !== null) {
    time = Date.now() + relativeMinutes * 60 * 1000;
  } else if (year !== null && month !== null && day !== null) {
    if (hour === null) hour = periodHour !== null ? periodHour : 10; // default 10:00
    if (minute === null) minute = 0;
    time = new Date(year, month, day, hour, minute, 0).getTime();
    // If the time is in the past and no specific day was set, try next day
    if (dayOffset === 0 && time < Date.now()) {
      // User said "今天" but time already passed -> move to tomorrow
      const nextDay = new Date(year, month, day + 1, hour, minute, 0);
      // Only auto-advance if user didn't specify an explicit hour
      // Actually let's not auto-advance, user can see and confirm
    }
  } else if (hour !== null) {
    // Has time but no date → assume today, or tomorrow if past
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute || 0, 0);
    if (todayDate.getTime() > Date.now()) {
      time = todayDate.getTime();
    } else {
      // Time already passed today → suggest tomorrow
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(hour, minute || 0, 0, 0);
      time = tomorrow.getTime();
    }
  } else if (dayOffset !== null || periodHour !== null) {
    // Has date period or day but no specific time
    if (year === null) {
      const d = new Date(today);
      if (dayOffset !== null) d.setDate(d.getDate() + dayOffset);
      year = d.getFullYear(); month = d.getMonth(); day = d.getDate();
    }
    const h = periodHour !== null ? periodHour : 10;
    time = new Date(year, month, day, h, 0, 0).getTime();
  }

  // If time is in the past and no day was specified, assume next occurrence
  if (time !== null && dayOffset === null && relativeMinutes === null && time < Date.now()) {
    // Only adjust if it's clearly meant to be future (e.g., just a time like "3点")
    // Check if original text had no date keyword
    const hadDateKeyword = /今天|明天|后天|大后天|周[一二三四五六日]|星期/.test(input);
    if (!hadDateKeyword) {
      // Move to tomorrow (or next appropriate day)
      const tomorrow = new Date(time);
      tomorrow.setDate(tomorrow.getDate() + 1);
      time = tomorrow.getTime();
    }
  }

  // Clean up text: remove leftover time-related noise
  text = text
    .replace(/\s*(早上|上午|中午|下午|晚上|夜晚|晚间|半夜|午夜|凌晨)\s*/g, '')
    .replace(/\s*(今天|明天|后天|大后天)\s*/g, '')
    .replace(/\s+点\s*/g, '')
    .replace(/\s+分\s*/g, '')
    .replace(/提醒我|请提醒|帮我提醒/g, '')
    .replace(/提醒/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { time, text };
}

/**
 * 格式化时间戳为展示字符串
 */
export function formatTime(ts) {
  if (!ts) return '待排期';
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((dateDay - today) / 86400000);

  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const timeStr = `${h}:${m}`;

  if (diffDays === 0) return `今天 ${timeStr}`;
  if (diffDays === 1) return `明天 ${timeStr}`;
  if (diffDays === 2) return `后天 ${timeStr}`;
  if (diffDays > 2 && diffDays <= 7) {
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    return `周${weekDays[d.getDay()]} ${timeStr}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${timeStr}`;
}

/**
 * 格式化仅时间部分（不含日期）
 */
export function formatTimeOnly(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 获取日期分组 key
 */
export function getDateGroup(ts) {
  if (!ts) return 'unscheduled';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(ts);
  const dateDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((dateDay - today) / 86400000);

  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 7) return 'thisWeek';
  return 'later';
}

export function getGroupLabel(group) {
  const labels = {
    'overdue': '⏰ 已过期',
    'today': '📅 今天',
    'tomorrow': '📅 明天',
    'thisWeek': '📅 本周',
    'later': '📅 更远',
    'unscheduled': '⏳ 待排期'
  };
  return labels[group] || group;
}

export function getGroupOrder(group) {
  const order = {
    'pinned': 0,
    'overdue': 1,
    'today': 2,
    'tomorrow': 3,
    'thisWeek': 4,
    'later': 5,
    'unscheduled': 6
  };
  return order[group] || 99;
}

/**
 * 计算剩余时间的文字描述
 */
export function getTimeRemaining(ts) {
  if (!ts) return '';
  const diff = ts - Date.now();
  if (diff <= 0) return '已到时间';
  if (diff < 60000) return '不到 1 分钟';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟后`;
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours} 小时${mins > 0 ? ` ${mins} 分钟` : ''}后`;
  }
  const days = Math.floor(diff / 86400000);
  return `${days} 天后`;
}

/**
 * 检查时间是否已过期
 */
export function isOverdue(ts) {
  if (!ts) return false;
  return ts < Date.now();
}

/**
 * 生成当前时间的 HH:MM 字符串
 */
export function getClockString() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
