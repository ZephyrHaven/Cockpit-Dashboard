// todo-focus.js — “今天”行动队列与番茄钟任务归因的共享逻辑。
// 任务本体仍保存在现有 todos.md；每项专注汇总保存在插件 data.json。

// 任务专注汇总只保留最近使用的一千项；避免 data.json 随长期使用无限膨胀。
const TODO_FOCUS_STATS_LIMIT = 1000;
const POMODORO_COMPLETION_LIMIT = 240;

function normalizeTodoId(value) {
  const id = String(value || '').trim();
  if (!/^[a-zA-Z0-9_-]{1,72}$/.test(id)) return '';
  if (Object.prototype.hasOwnProperty.call(Object.prototype, id)) return '';
  return id;
}

function createTodoId() {
  try {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return 'todo-' + uuid.replace(/-/g, '').slice(0, 16);
  } catch (e) {}
  return 'todo-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function ensureTodoIds(todos, idFactory = createTodoId) {
  const list = Array.isArray(todos) ? todos : [];
  const used = new Set();
  list.forEach((todo, index) => {
    if (!todo || typeof todo !== 'object') return;
    let id = normalizeTodoId(todo.id);
    if (!id || used.has(id)) {
      let attempts = 0;
      do {
        id = normalizeTodoId(idFactory()) || ('todo-' + Date.now().toString(36) + '-' + index + '-' + attempts);
        attempts++;
      } while (used.has(id) && attempts < 20);
      if (used.has(id)) id += '-' + index;
      todo.id = id;
    }
    used.add(id);
  });
  return list;
}

function todoDayKey(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
  }
  if (typeof value.format === 'function') return String(value.format('YYYY-MM-DD') || '');
  if (value instanceof Date && Number.isFinite(value.valueOf())) return value.toISOString().slice(0, 10);
  return '';
}

function sortTodayTodoItems(items) {
  const priorityOrder = { high:0, mid:1, low:2 };
  return items.slice().sort((a, b) => {
    const priorityDiff = (priorityOrder[a?.priority] ?? 1) - (priorityOrder[b?.priority] ?? 1);
    if (priorityDiff) return priorityDiff;
    const dueDiff = todoDayKey(a?.dueDate).localeCompare(todoDayKey(b?.dueDate));
    if (dueDiff) return dueDiff;
    return Number(b?.created?.valueOf?.() || 0) - Number(a?.created?.valueOf?.() || 0);
  });
}

function groupTodayTodos(todos, today) {
  const todayKey = todoDayKey(today) || String(today || '').slice(0, 10);
  const buckets = { overdue:[], today:[], priority:[], inbox:[] };
  (Array.isArray(todos) ? todos : []).forEach((todo) => {
    if (!todo || todo.done) return;
    const dueKey = todoDayKey(todo.dueDate);
    if (dueKey && dueKey < todayKey) buckets.overdue.push(todo);
    else if (dueKey === todayKey) buckets.today.push(todo);
    else if (todo.priority === 'high') buckets.priority.push(todo);
    else if (!dueKey) buckets.inbox.push(todo);
  });
  return ['overdue', 'today', 'priority', 'inbox']
    .map((key) => ({ key, items:sortTodayTodoItems(buckets[key]) }))
    .filter((group) => group.items.length > 0);
}

function limitTodoGroups(groups, limit = 120) {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(Number(limit) || 120)));
  let remaining = safeLimit;
  let total = 0;
  const limited = [];
  (Array.isArray(groups) ? groups : []).forEach((group) => {
    const items = Array.isArray(group?.items) ? group.items : [];
    total += items.length;
    if (!remaining || !items.length) return;
    const visible = items.slice(0, remaining);
    limited.push({ ...group, items:visible, totalItems:items.length });
    remaining -= visible.length;
  });
  const rendered = safeLimit - remaining;
  return { groups:limited, total, rendered, hasMore:rendered < total };
}

async function deferTodosToDate(todos, targetDate, persist) {
  const items = (Array.isArray(todos) ? todos : []).filter((todo) => todo && !todo.done);
  const previousDates = items.map((todo) => todo.dueDate || null);
  items.forEach((todo) => {
    todo.dueDate = typeof targetDate?.clone === 'function' ? targetDate.clone() : targetDate;
  });
  try {
    if (typeof persist !== 'function' || await persist() !== true) throw new Error('todo-save-failed');
    return true;
  } catch (e) {
    items.forEach((todo, index) => { todo.dueDate = previousDates[index]; });
    return false;
  }
}

function pomodoroTaskRef(todo) {
  if (!todo || todo.done) return null;
  const id = normalizeTodoId(todo.id);
  const text = String(todo.text || '').trim().slice(0, 180);
  return id && text ? { id, text } : null;
}

function canChangePomodoroTask(isRunning, hasProgress, currentTask, nextTask) {
  if (!isRunning && !hasProgress) return true;
  const currentId = normalizeTodoId(currentTask?.id);
  const nextId = normalizeTodoId(nextTask?.id);
  return !!currentId && currentId === nextId;
}

function normalizePomodoroTaskStat(key, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const taskId = normalizeTodoId(value.taskId || key);
  if (!taskId) return null;
  const text = String(value.text || '').trim().slice(0, 180);
  const totalMinutes = Math.max(0, Math.min(1000000, Math.round(Number(value.totalMinutes) || 0)));
  const sessions = Math.max(0, Math.min(100000, Math.round(Number(value.sessions) || 0)));
  const parsedAt = Date.parse(value.lastFocusedAt || '');
  const lastFocusedAt = Number.isFinite(parsedAt) ? new Date(parsedAt).toISOString() : '';
  if (!totalMinutes && !sessions) return null;
  return { taskId, text, totalMinutes, sessions, lastFocusedAt };
}

function normalizePomodoroTaskStats(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return Object.create(null);
  const entries = Object.entries(raw).map(([key, value]) => normalizePomodoroTaskStat(key, value)).filter(Boolean);
  entries.sort((a, b) => Date.parse(b.lastFocusedAt || 0) - Date.parse(a.lastFocusedAt || 0));
  const result = Object.create(null);
  entries.slice(0, TODO_FOCUS_STATS_LIMIT).forEach((entry) => { result[entry.taskId] = entry; });
  return result;
}

function recordPomodoroTaskFocus(rawStats, task, minutes, focusedAt) {
  const ref = task && normalizeTodoId(task.id) && String(task.text || '').trim()
    ? { id:normalizeTodoId(task.id), text:String(task.text).trim().slice(0, 180) }
    : null;
  const amount = Math.max(0, Math.min(1440, Math.round(Number(minutes) || 0)));
  const stats = normalizePomodoroTaskStats(rawStats);
  if (!ref || !amount) return stats;
  const previous = Object.prototype.hasOwnProperty.call(stats, ref.id)
    ? stats[ref.id]
    : { taskId:ref.id, text:ref.text, totalMinutes:0, sessions:0, lastFocusedAt:'' };
  const parsedAt = Date.parse(focusedAt || '');
  stats[ref.id] = {
    taskId:ref.id,
    text:ref.text,
    totalMinutes:previous.totalMinutes + amount,
    sessions:previous.sessions + 1,
    lastFocusedAt:Number.isFinite(parsedAt) ? new Date(parsedAt).toISOString() : new Date().toISOString()
  };
  return normalizePomodoroTaskStats(stats);
}

function getTodoFocusStat(rawStats, todo) {
  const id = normalizeTodoId(todo?.id);
  if (!id || !rawStats || typeof rawStats !== 'object' || Array.isArray(rawStats)) return null;
  if (!Object.prototype.hasOwnProperty.call(rawStats, id)) return null;
  return normalizePomodoroTaskStat(id, rawStats[id]);
}

function normalizePomodoroCompletions(raw) {
  const seen = new Set();
  const entries = (Array.isArray(raw) ? raw : []).map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = normalizeTodoId(value.id);
    const day = todoDayKey(value.day);
    const minutes = Math.max(1, Math.min(1440, Math.round(Number(value.minutes) || 0)));
    const targetMinutes = Math.max(minutes, Math.min(1000000, Math.round(Number(value.targetMinutes) || 0)));
    const parsedAt = Date.parse(value.completedAt || '');
    if (!id || !day || !minutes || !Number.isFinite(parsedAt) || seen.has(id)) return null;
    seen.add(id);
    const task = value.task ? pomodoroTaskRef({ ...value.task, done:false }) : null;
    return {
      id,
      day,
      minutes,
      targetMinutes,
      task,
      completedAt:new Date(parsedAt).toISOString(),
      appliedToFocusHistory:value.appliedToFocusHistory === true
    };
  }).filter(Boolean);
  entries.sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  const pending = entries.filter((entry) => !entry.appliedToFocusHistory);
  const applied = entries.filter((entry) => entry.appliedToFocusHistory);
  return pending.concat(applied.slice(0, Math.max(0, POMODORO_COMPLETION_LIMIT - pending.length)));
}

function recordPomodoroCompletion(rawStats, rawCompletions, input) {
  const id = normalizeTodoId(input?.id);
  const day = todoDayKey(input?.day);
  const minutes = Math.max(1, Math.min(1440, Math.round(Number(input?.minutes) || 0)));
  const parsedAt = Date.parse(input?.completedAt || '');
  const stats = normalizePomodoroTaskStats(rawStats);
  const completions = normalizePomodoroCompletions(rawCompletions);
  const existing = id ? completions.find((entry) => entry.id === id) : null;
  if (existing) return { stats, completions, entry:existing, isNew:false };
  if (!id || !day || !minutes || !Number.isFinite(parsedAt)) return { stats, completions, entry:null, isNew:false };
  const currentMinutes = Math.max(0, Math.min(1000000, Math.round(Number(input?.currentFocusMinutes) || 0)));
  const priorTarget = completions
    .filter((entry) => entry.day === day)
    .reduce((max, entry) => Math.max(max, entry.targetMinutes), 0);
  const task = input?.task ? pomodoroTaskRef({ ...input.task, done:false }) : null;
  const entry = {
    id,
    day,
    minutes,
    targetMinutes:Math.max(currentMinutes, priorTarget) + minutes,
    task,
    completedAt:new Date(parsedAt).toISOString(),
    appliedToFocusHistory:false
  };
  return {
    stats:task ? recordPomodoroTaskFocus(stats, task, minutes, entry.completedAt) : stats,
    completions:normalizePomodoroCompletions([entry, ...completions]),
    entry,
    isNew:true
  };
}

function markPomodoroCompletionsApplied(raw, ids) {
  const applied = new Set(Array.isArray(ids) ? ids.map(normalizeTodoId).filter(Boolean) : []);
  return normalizePomodoroCompletions(raw).map((entry) => (
    applied.has(entry.id) ? { ...entry, appliedToFocusHistory:true } : entry
  ));
}

async function replayPomodoroCompletions(raw, writeFocus, markApplied) {
  const pending = normalizePomodoroCompletions(raw).filter((entry) => !entry.appliedToFocusHistory);
  const byDay = new Map();
  pending.forEach((entry) => {
    const current = byDay.get(entry.day) || { targetMinutes:0, ids:[] };
    current.targetMinutes = Math.max(current.targetMinutes, entry.targetMinutes);
    current.ids.push(entry.id);
    byDay.set(entry.day, current);
  });
  const appliedIds = [];
  const focusByDay = new Map();
  for (const [day, state] of byDay.entries()) {
    try {
      const actualMinutes = await writeFocus(day, state.targetMinutes);
      focusByDay.set(day, actualMinutes);
      appliedIds.push(...state.ids);
    } catch (e) {}
  }
  if (appliedIds.length) await markApplied(appliedIds);
  return { appliedIds, focusByDay };
}

// 独立源码测试时导出；打包环境已先定义 PLUGIN_ID，因此不会改写插件入口。
if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = {
    ensureTodoIds,
    groupTodayTodos,
    limitTodoGroups,
    deferTodosToDate,
    normalizePomodoroTaskStats,
    recordPomodoroTaskFocus,
    getTodoFocusStat,
    pomodoroTaskRef,
    canChangePomodoroTask,
    normalizePomodoroCompletions,
    recordPomodoroCompletion,
    markPomodoroCompletionsApplied,
    replayPomodoroCompletions
  };
}
