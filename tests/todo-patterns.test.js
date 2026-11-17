#!/usr/bin/env node
// todo-patterns 纯函数测试
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function mkMoment(iso) {
  const d = new Date(iso);
  return {
    _d: d,
    valueOf: () => d.getTime(),
    hour: () => d.getHours(),
    diff: (other, unit) => {
      const ms = d.getTime() - other._d.getTime();
      return unit === 'days' ? Math.floor(ms / 86400000) : ms;
    },
  };
}
const context = vm.createContext({ console, window:{ moment: mkMoment }, Math, Set, Map, Array, Object, Number, String, JSON, Date, Boolean, isFinite, parseInt });
const source = fs.readFileSync(path.join(__dirname, '../src/todo-patterns.js'), 'utf8');
vm.runInContext(source + ';globalThis.tp={computeTodoPatterns};', context);
const { computeTodoPatterns } = context.tp;

const now = mkMoment('2026-11-17T12:00:00');
const todos = [
  { done:true, created:mkMoment('2026-11-01T09:00:00'), doneDate:mkMoment('2026-11-03T09:00:00'), tags:['work'], priority:'high' },
  { done:true, created:mkMoment('2026-11-05T09:00:00'), doneDate:mkMoment('2026-11-09T15:00:00'), tags:['work'], priority:'mid' },
  { done:false, dueDate:mkMoment('2026-11-10T00:00:00'), dueHasTime:false, tags:['work'], priority:'high' },
  { done:false, dueDate:mkMoment('2026-12-01T00:00:00'), dueHasTime:false, tags:['home'], priority:'low' },
  { done:true, created:mkMoment('2026-11-10T09:00:00'), doneDate:mkMoment('2026-11-10T18:00:00'), tags:['home'] },
];

const r = computeTodoPatterns(todos, now);
assert.equal(r.doneCount, 3, 'done count');
assert.equal(r.openCount, 2, 'open count');
// durations: 2, 4, 0 days -> avg 2
assert.equal(r.avgDoneDays, 2, 'avg done days across samples');
assert.equal(r.sampleSize, 3, 'three completed with created+done');
// work tag: done 2, open 1 (overdue 1)
const work = r.tagRows.find((x) => x.tag === 'work');
assert.equal(work.done, 2);
assert.equal(work.open, 1);
assert.equal(work.overdue, 1);
assert.ok(work.overdueRate > 0);
// most backlogged should be a tag with open>0
assert.ok(r.mostBacklogged && r.mostBacklogged.open > 0);
// peak hour: completions at 09,15,18 -> each 1, first max is 9
assert.equal(r.peakHour, 9, 'peak hour first-max');

// 边界：空数组不抛错
const empty = computeTodoPatterns([], now);
assert.equal(empty.doneCount, 0);
assert.equal(empty.avgDoneDays, null);

// 边界：非数组
assert.equal(computeTodoPatterns(null, now).doneCount, 0);

// 缺少时间字段的完成条目安全跳过，不进入样本
const noTime = computeTodoPatterns([{ done:true, tags:['x'] }], now);
assert.equal(noTime.doneCount, 1);
assert.equal(noTime.sampleSize, 0);

console.log('todo-patterns: all assertions passed');
