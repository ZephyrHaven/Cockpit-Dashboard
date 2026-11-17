#!/usr/bin/env node
// computeHabitInsights 纯函数测试
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// moment-like：以本地时间构造，支持链式 clone/add/format/day/diff/valueOf。
function makeMoment(input) {
  let d = input instanceof Date ? new Date(input.getTime()) : (typeof input === 'string' ? new Date(input + 'T00:00:00') : new Date(input));
  const pad = (n) => String(n).padStart(2, '0');
  const api = {
    _d: d,
    clone: () => makeMoment(new Date(d.getTime())),
    add: (n, unit) => { const nd = new Date(d.getTime()); if (unit === 'day') nd.setDate(nd.getDate() + n); return makeMoment(nd); },
    day: () => d.getDay(),
    format: (fmt) => fmt === 'YYYY-MM-DD' ? (d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())) : '',
    diff: (other, unit) => { const ms = d.getTime() - other._d.getTime(); return unit === 'days' ? Math.floor(ms/86400000) : ms; },
    valueOf: () => d.getTime(),
  };
  return api;
}
const context = vm.createContext({ console, window:{ moment: makeMoment }, Math, Set, Map, Array, Object, Number, String, JSON, Date, Boolean, isFinite, parseInt });
const src = fs.readFileSync(path.join(__dirname, '../src/habits-core.js'), 'utf8');
vm.runInContext(src + ';globalThis.hci={computeHabitInsights,computeStreak,computeBestStreak};', context);
const { computeHabitInsights } = context.hci;

// 构造：3 周记录，每个周三都断（其余天都打卡）。今天是 2026-11-17（周二）。
// 2026-11-17 是星期二。
const today = makeMoment('2026-11-17');
// 生成最近 21 天，跳过所有周三（day()===3）
const log = [];
for (let i = 20; i >= 0; i--) {
  const m = today.clone().add(-i, 'day');
  if (m.day() === 3) continue; // 周三断签
  log.push(m.format('YYYY-MM-DD'));
}
const r = computeHabitInsights(log, today);
// 样本至少 21 天
assert.ok(r.sampleDays >= 18, 'sample days >= 18, got ' + r.sampleDays);
// 周三（3）应是断签最多
assert.equal(r.worstWeekday, 3, 'worst weekday is Wednesday (3), got ' + r.worstWeekday);
assert.ok(r.longestStreak >= 5, 'longest streak >= 5 (Tue->Thu->... skipping Wed), got ' + r.longestStreak);
// 今天已打卡 -> streak
assert.equal(r.currentRisk, 'streak');

// 空日志
const empty = computeHabitInsights([], today);
assert.equal(empty.currentRisk, 'none');
assert.equal(empty.worstWeekday, null);
assert.equal(empty.longestStreak, 0);

// 今天未打卡
const noToday = log.filter((k) => k !== today.format('YYYY-MM-DD'));
assert.equal(computeHabitInsights(noToday, today).currentRisk, 'due');

// 坏输入不抛错
assert.equal(computeHabitInsights(null, today).sampleDays, 0);
assert.equal(computeHabitInsights(['bad','2026-13-99'], today).sampleDays, 0);

console.log('habits insights: all assertions passed');
