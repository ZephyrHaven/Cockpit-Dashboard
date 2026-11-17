// habits-core.js — 习惯打卡纯数据层：解析 / 序列化 / 连续天数统计。
// 数据保存在 vault 内 _data/habits.md，跟随库同步；不写插件 data.json。

const HABIT_LOG_CAP = 400; // 每条习惯最多保留的打卡日期数（约一年多的每日记录）
const HABIT_ICON_MAX = 8;

let habitFileMutationQueue = Promise.resolve();

function queueHabitFileMutation(operation) {
  const next = habitFileMutationQueue.catch(() => {}).then(operation);
  habitFileMutationQueue = next;
  return next;
}

function habitId() {
  try { return 'h-' + globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 10); } catch (e) {}
  return 'h-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

function normalizeHabitName(value) {
  return String(value || '').replace(/[\r\n|]+/g, ' ').trim().slice(0, 60);
}

function normalizeHabitIcon(value) {
  // 只允许一个字形（emoji 或单个字符），避免把名字里的普通文本当图标渲染。
  const text = String(value || '').trim().slice(0, HABIT_ICON_MAX);
  return Array.from(text).length ? Array.from(text)[0] : '';
}

function normalizeHabitDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null;
}

// 打卡日志统一为“去重 + 升序 + 截断到最近 N 天”的 YYYY-MM-DD 数组。
function normalizeHabitLog(raw) {
  const seen = new Set();
  (Array.isArray(raw) ? raw : String(raw || '').split(/[,\s]+/)).forEach((item) => {
    const key = normalizeHabitDateKey(item);
    if (key) seen.add(key);
  });
  return Array.from(seen).sort().slice(-HABIT_LOG_CAP);
}

function splitHabitMeta(meta) {
  const managed = {};
  const extra = [];
  String(meta || '').split('|').forEach((segment) => {
    const part = segment.trim();
    if (!part) return;
    const km = part.match(/^(id|icon|created|log)\s*:\s*([\s\S]+)$/);
    if (!km) { extra.push(part); return; }
    managed[km[1]] = km[2].trim();
  });
  return { managed, extra };
}

function parseHabitLine(line) {
  const m = String(line || '').match(/^-\s+(.+?)(?:\s*\|\s*(.+))?\s*$/);
  if (!m) return null;
  const { managed, extra } = splitHabitMeta(m[2]);
  const name = normalizeHabitName(m[1]);
  if (!name) return null;
  return {
    id: managed.id || '',
    name,
    icon: normalizeHabitIcon(managed.icon),
    created: normalizeHabitDateKey(managed.created),
    log: normalizeHabitLog(managed.log),
    _extraMeta: extra
  };
}

function parseHabitsContent(content) {
  const habits = [];
  for (const line of String(content || '').split('\n')) {
    if (/^#/.test(line)) continue;
    const entry = parseHabitLine(line);
    if (!entry) continue;
    habits.push(entry);
  }
  return habits.slice(0, 50);
}

function buildHabitLine(habit) {
  const meta = [];
  if (habit.id) meta.push('id:' + habit.id);
  if (habit.icon) meta.push('icon:' + habit.icon);
  if (habit.created) meta.push('created:' + habit.created);
  if (habit.log && habit.log.length) meta.push('log:' + habit.log.join(','));
  if (Array.isArray(habit._extraMeta)) {
    habit._extraMeta.forEach((segment) => { const part = String(segment || '').trim(); if (part) meta.push(part); });
  }
  return '- ' + habit.name + (meta.length ? ' | ' + meta.join(' | ') : '');
}

function serializeHabits(habits) {
  const prefix = '# 习惯打卡\n\n';
  const lines = (Array.isArray(habits) ? habits : []).map((habit) => buildHabitLine(habit));
  return prefix + lines.join('\n') + '\n';
}

async function writeHabitsUnlocked(vault, habits) {
  try {
    const dir = HABIT_FILE.split('/')[0];
    if (!vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
    const file = vault.getAbstractFileByPath(HABIT_FILE);
    const body = serializeHabits(habits);
    if (!file) {
      await vault.create(HABIT_FILE, body);
      return true;
    }
    await vault.modify(file, body);
    return true;
  } catch (e) { console.warn('saveHabits', e); return false; }
}

async function loadHabits(vault) {
  return queueHabitFileMutation(async () => {
    try {
      const file = vault.getAbstractFileByPath(HABIT_FILE);
      if (!file) return [];
      const content = await vault.read(file);
      return parseHabitsContent(content);
    } catch (e) {
      console.warn('loadHabits', e);
      return [];
    }
  });
}

// 整表保存（新增/删除/重命名/补卡都会走这里）；mutator 返回 false 表示放弃本次变更。
async function mutateHabits(vault, mutator) {
  return queueHabitFileMutation(async () => {
    try {
      const file = vault.getAbstractFileByPath(HABIT_FILE);
      const habits = file ? parseHabitsContent(await vault.read(file)) : [];
      habits.forEach((habit) => { if (!habit.id) habit.id = habitId(); });
      const result = await mutator(habits);
      if (result === false) return { saved:false, habits, result };
      const saved = await writeHabitsUnlocked(vault, habits);
      return { saved, habits, result };
    } catch (e) {
      console.warn('mutateHabits', e);
      return { saved:false, habits:null, result:null };
    }
  });
}

// 连续天数：从今天往前数连续打卡的天数；今天还没打卡不打断昨天的连胜。
// 注意：用「重新赋值」而不是依赖 moment.subtract 的原地变异语义，
// 纯函数在任何（可变/不可变）moment 实现下行为一致。
function computeStreak(logDates, today) {
  const set = logDates instanceof Set ? logDates : new Set(Array.isArray(logDates) ? logDates : []);
  let streak = 0;
  let cursor = today.clone();
  if (!set.has(cursor.format('YYYY-MM-DD'))) cursor = cursor.subtract(1, 'day');
  while (set.has(cursor.format('YYYY-MM-DD'))) {
    streak++;
    cursor = cursor.subtract(1, 'day');
  }
  return streak;
}

// 最佳连续天数（用于周回顾/成就展示）：全量扫描一次即可。
function computeBestStreak(logDates) {
  const dates = (Array.isArray(logDates) ? logDates : []).slice().sort();
  let best = 0; let run = 0; let prev = null;
  dates.forEach((key) => {
    if (prev && window.moment(key).diff(window.moment(prev), 'days') === 1) run++;
    else run = 1;
    if (run > best) best = run;
    prev = key;
  });
  return best;
}

// 习惯失败归因（纯函数）：基于打卡日期集合，分析"最易断在周几 / 当前风险 / 最长连击"。
// 返回：
//   - brokenWeekdays: 7 长度数组（0=周日…6=周六），记录该星期几的"断签次数"
//   - hitWeekdays: 同上，记录命中次数
//   - worstWeekday: 断签最多的星期几（0-6），无足够历史时 null
//   - bestWeekday: 打卡命中率最高的星期几，无历史时 null
//   - currentRisk: 'streak'|'due'|'none'
//   - longestStreak: 全量最长连击
// 只依赖 YYYY-MM-DD 字符串数组与一个 moment-like today，不修改入参。
function computeHabitInsights(logDates, today, options = {}) {
  const keys = (Array.isArray(logDates) ? logDates : []).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(String(key || ''))).slice().sort();
  const set = new Set(keys);
  const todayKey = today ? today.format('YYYY-MM-DD') : null;
  const result = { brokenWeekdays:[0,0,0,0,0,0,0], hitWeekdays:[0,0,0,0,0,0,0], worstWeekday:null, bestWeekday:null, currentRisk:'none', longestStreak:0, sampleDays:0 };
  if (!keys.length) return result;
  let best = 0, run = 0, prev = null;
  keys.forEach((key) => {
    if (prev && window.moment(key).diff(window.moment(prev), 'days') === 1) run++;
    else run = 1;
    if (run > best) best = run;
    prev = key;
  });
  result.longestStreak = best;
  if (todayKey) result.currentRisk = set.has(todayKey) ? 'streak' : 'due';
  const maxScanDays = Number.isFinite(options.maxScanDays) ? options.maxScanDays : 365;
  const first = keys[0];
  const endKey = todayKey || keys[keys.length - 1];
  let cursor = window.moment(first);
  const endMoment = window.moment(endKey);
  let scanned = 0;
  while (cursor.valueOf() <= endMoment.valueOf() && scanned < maxScanDays) {
    const key = cursor.format('YYYY-MM-DD');
    const dow = cursor.day();
    if (set.has(key)) result.hitWeekdays[dow] += 1;
    else result.brokenWeekdays[dow] += 1;
    result.sampleDays += 1;
    scanned += 1;
    cursor = cursor.clone().add(1, 'day');
  }
  const pickMax = (arr) => { let idx = -1, val = -1; arr.forEach((v, i) => { if (v > val) { val = v; idx = i; } }); return val > 0 ? idx : null; };
  const pickBestRate = () => {
    let bestIdx = null, bestRate = -1;
    for (let d = 0; d < 7; d++) {
      const total = result.hitWeekdays[d] + result.brokenWeekdays[d];
      if (total < 2) continue;
      const rate = result.hitWeekdays[d] / total;
      if (rate > bestRate) { bestRate = rate; bestIdx = d; }
    }
    return bestIdx;
  };
  result.worstWeekday = pickMax(result.brokenWeekdays);
  result.bestWeekday = pickBestRate();
  return result;
}

// 统计区间内 [start, end] 每天的完成情况，返回命中日期的 Set。
function habitDaysInRange(logDates, start, end) {
  const set = new Set(Array.isArray(logDates) ? logDates : []);
  const hits = new Set();
  // 用时间戳比较而不是 moment 插件方法（isSameOrBefore），减少对可选插件的依赖。
  const endValue = end.clone().valueOf();
  let cursor = start.clone().startOf('day');
  while (cursor.valueOf() <= endValue) {
    const key = cursor.format('YYYY-MM-DD');
    if (set.has(key)) hits.add(key);
    cursor = cursor.add(1, 'day');
  }
  return hits;
}
