// alarm-core.js — 闹钟纯数据与时间计算；不依赖 Obsidian 或 DOM。

const ALARM_RECOVERY_WINDOW_MS = 10 * 60 * 1000;
const ALARM_SNOOZE_MS = 10 * 60 * 1000;

function alarmId() {
  return 'alarm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function normalizeAlarmTime(value) {
  const parts = String(value || '08:00').split(':');
  const hour = Math.max(0, Math.min(23, Number.parseInt(parts[0], 10) || 0));
  const minute = Math.max(0, Math.min(59, Number.parseInt(parts[1], 10) || 0));
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}

function normalizeAlarm(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim().slice(0, 80);
  if (!name) return null;
  const id = String(raw.id || alarmId()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || alarmId();
  const scheduleType = ['once', 'daily', 'weekdays'].includes(raw.scheduleType) ? raw.scheduleType : 'daily';
  const weekdays = Array.from(new Set((Array.isArray(raw.weekdays) ? raw.weekdays : [])
    .map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a, b) => a - b);
  const onceValue = raw.onceAt ? new Date(raw.onceAt) : null;
  const onceAt = onceValue && Number.isFinite(onceValue.getTime()) ? onceValue.toISOString() : null;
  const snoozeValue = raw.snoozedUntil ? new Date(raw.snoozedUntil) : null;
  const lastValue = raw.lastTriggeredAt ? new Date(raw.lastTriggeredAt) : null;
  const rawTodoId = String(raw.todoId || '').trim();
  const todoId = /^[a-zA-Z0-9_-]{1,72}$/.test(rawTodoId)
    && !Object.prototype.hasOwnProperty.call(Object.prototype, rawTodoId) ? rawTodoId : '';
  return {
    id,
    name,
    enabled:raw.enabled !== false,
    scheduleType,
    time:normalizeAlarmTime(raw.time),
    weekdays:scheduleType === 'weekdays' ? weekdays : [],
    onceAt:scheduleType === 'once' ? onceAt : null,
    snoozedUntil:snoozeValue && Number.isFinite(snoozeValue.getTime()) ? snoozeValue.toISOString() : null,
    lastTriggeredAt:lastValue && Number.isFinite(lastValue.getTime()) ? lastValue.toISOString() : null,
    todoId,
    linkedTodoText:todoId ? String(raw.linkedTodoText || '').trim().slice(0, 160) : '',
    createdAt:String(raw.createdAt || new Date().toISOString())
  };
}

function normalizeAlarms(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).map(normalizeAlarm).filter((alarm) => {
    if (!alarm || seen.has(alarm.id)) return false;
    seen.add(alarm.id);
    return true;
  });
}

function alarmClockParts(alarm) {
  const [hour, minute] = normalizeAlarmTime(alarm?.time).split(':').map(Number);
  return { hour, minute };
}

function nextAlarmOccurrence(rawAlarm, afterValue = Date.now()) {
  const alarm = normalizeAlarm(rawAlarm);
  if (!alarm) return null;
  const after = new Date(afterValue);
  if (!Number.isFinite(after.getTime())) return null;
  const snooze = alarm.snoozedUntil ? new Date(alarm.snoozedUntil) : null;
  if (snooze && snooze.getTime() > after.getTime()) return snooze;
  if (!alarm.enabled) return null;
  if (alarm.scheduleType === 'once') {
    const once = alarm.onceAt ? new Date(alarm.onceAt) : null;
    return once && once.getTime() > after.getTime() ? once : null;
  }
  const { hour, minute } = alarmClockParts(alarm);
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidate = new Date(after);
    candidate.setSeconds(0, 0);
    candidate.setDate(candidate.getDate() + dayOffset);
    candidate.setHours(hour, minute, 0, 0);
    if (candidate.getTime() <= after.getTime()) continue;
    if (alarm.scheduleType === 'weekdays' && !alarm.weekdays.includes(candidate.getDay())) continue;
    return candidate;
  }
  return null;
}

function alarmOccurrenceToday(alarm, now) {
  const { hour, minute } = alarmClockParts(alarm);
  const occurrence = new Date(now);
  occurrence.setHours(hour, minute, 0, 0);
  if (alarm.scheduleType === 'weekdays' && !alarm.weekdays.includes(occurrence.getDay())) return null;
  return occurrence;
}

function claimDueAlarms(rawAlarms, nowValue = Date.now(), recoveryWindowMs = ALARM_RECOVERY_WINDOW_MS) {
  const now = new Date(nowValue);
  const nowMs = now.getTime();
  const windowMs = Math.max(0, Number(recoveryWindowMs) || 0);
  const due = [];
  const alarms = normalizeAlarms(rawAlarms).map((alarm) => {
    let occurrence = null;
    const snooze = alarm.snoozedUntil ? new Date(alarm.snoozedUntil) : null;
    if (snooze && snooze.getTime() <= nowMs) {
      occurrence = snooze;
      alarm.snoozedUntil = null;
    } else if (alarm.enabled && alarm.scheduleType === 'once') {
      const once = alarm.onceAt ? new Date(alarm.onceAt) : null;
      if (once && once.getTime() <= nowMs) {
        occurrence = once;
        alarm.enabled = false;
      }
    } else if (alarm.enabled) {
      const today = alarmOccurrenceToday(alarm, now);
      if (today && today.getTime() <= nowMs) occurrence = today;
    }
    if (!occurrence) return alarm;
    const occurrenceMs = occurrence.getTime();
    const lastMs = alarm.lastTriggeredAt ? new Date(alarm.lastTriggeredAt).getTime() : -Infinity;
    if (occurrenceMs > lastMs && nowMs - occurrenceMs <= windowMs) {
      alarm.lastTriggeredAt = occurrence.toISOString();
      due.push({ ...alarm, occurrenceAt:occurrence.toISOString() });
    }
    return alarm;
  });
  return { alarms, due };
}

function reconcileTodoAlarms(rawAlarms, rawTodos) {
  const todos = new Map((Array.isArray(rawTodos) ? rawTodos : [])
    .filter((todo) => todo && typeof todo === 'object' && typeof todo.id === 'string')
    .map((todo) => [todo.id, todo]));
  return normalizeAlarms(rawAlarms).map((alarm) => {
    if (!alarm.todoId) return alarm;
    const todo = todos.get(alarm.todoId);
    if (!todo || todo.done) {
      alarm.enabled = false;
      alarm.snoozedUntil = null;
      return alarm;
    }
    alarm.linkedTodoText = String(todo.text || alarm.linkedTodoText || '').trim().slice(0, 160);
    return alarm;
  });
}

function formatAlarmSchedule(rawAlarm, language = 'zh-CN') {
  const alarm = normalizeAlarm(rawAlarm);
  if (!alarm) return '';
  const en = language === 'en';
  if (alarm.scheduleType === 'once') {
    const date = alarm.onceAt ? new Date(alarm.onceAt) : null;
    if (!date) return en ? 'One time' : '仅一次';
    return new Intl.DateTimeFormat(en ? 'en-US' : 'zh-CN', {
      month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
    }).format(date);
  }
  if (alarm.scheduleType === 'daily') return (en ? 'Daily · ' : '每天 · ') + alarm.time;
  const zh = ['周日','周一','周二','周三','周四','周五','周六'];
  const english = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return (en ? alarm.weekdays.map((day) => english[day]).join(', ') : alarm.weekdays.map((day) => zh[day]).join('、')) + ' · ' + alarm.time;
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { normalizeAlarmTime, normalizeAlarm, normalizeAlarms, nextAlarmOccurrence, claimDueAlarms, reconcileTodoAlarms, formatAlarmSchedule };
}
