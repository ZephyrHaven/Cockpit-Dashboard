#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const framework = fs.readFileSync(path.join(root, 'src/_framework.js'), 'utf8');
const calendar = fs.readFileSync(path.join(root, 'src/calendar.js'), 'utf8');
const pomodoro = fs.readFileSync(path.join(root, 'src/pomodoro.js'), 'utf8');

assert.match(calendar, /openTodoEditor/, 'Calendar owns its add/edit interactions.');
assert.match(framework, /buildCalendar\(root, this\._todos/, 'Dashboard delegates calendar rendering to calendar.js.');
assert.doesNotMatch(framework, /===== 3\.5 日历看板 =====[\s\S]*?===== 3\. Categories =====/, 'Framework must not retain a second calendar implementation.');
assert.match(framework, /refreshTodosRef\(\{ persist: false \}\)/, 'Calendar toggles refresh the list without a second Markdown write.');
assert.doesNotMatch(calendar, /await onTodoToggle\(\);\s*renderAll\(\);/, 'Calendar toggles must not redraw the calendar twice.');
assert.match(pomodoro, /function buildPomodoro\(/, 'Pomodoro has a dedicated module entry point.');
assert.match(pomodoro, /function createPomodoro\(/, 'Pomodoro implementation lives in its dedicated module.');
assert.doesNotMatch(framework, /_createPomodoro\(/, 'Framework must not retain the pomodoro implementation.');

console.log('P0 regression checks passed');
