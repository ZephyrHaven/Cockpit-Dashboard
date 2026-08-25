#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeAlarm,
  normalizeAlarms,
  nextAlarmOccurrence,
  claimDueAlarms,
  formatAlarmSchedule,
  reconcileTodoAlarms
} = require('../src/alarm-core.js');

function localDate(year, month, day, hour, minute, second = 0) {
  return new Date(year, month - 1, day, hour, minute, second, 0);
}

const daily = normalizeAlarm({
  id:'daily-review',
  name:'每日复盘',
  enabled:true,
  scheduleType:'daily',
  time:'08:30'
});
assert.equal(daily.time, '08:30');
assert.deepEqual(daily.weekdays, []);
assert.equal(
  nextAlarmOccurrence(daily, localDate(2026, 8, 13, 8, 0)).getTime(),
  localDate(2026, 8, 13, 8, 30).getTime(),
  'A daily alarm still ahead today should ring today.'
);
assert.equal(
  nextAlarmOccurrence(daily, localDate(2026, 8, 13, 9, 0)).getTime(),
  localDate(2026, 8, 14, 8, 30).getTime(),
  'A daily alarm already passed today should move to tomorrow.'
);

const weekdays = normalizeAlarm({
  id:'weekday-standup',
  name:'工作日站会',
  enabled:true,
  scheduleType:'weekdays',
  time:'09:15',
  weekdays:[5, 1, 1, 3, 9]
});
assert.deepEqual(weekdays.weekdays, [1, 3, 5], 'Weekdays are unique, sorted, and limited to Sunday through Saturday.');
assert.equal(
  nextAlarmOccurrence(weekdays, localDate(2026, 8, 14, 10, 0)).getTime(),
  localDate(2026, 8, 17, 9, 15).getTime(),
  'A Friday alarm that has passed should skip the weekend and use Monday.'
);

const oneTimeAt = localDate(2026, 8, 15, 7, 45);
const once = normalizeAlarm({
  id:'flight',
  name:'出发',
  enabled:true,
  scheduleType:'once',
  onceAt:oneTimeAt.toISOString(),
  time:'99:90'
});
assert.equal(once.time, '23:59', 'Invalid time parts are clamped to a valid clock time.');
assert.equal(nextAlarmOccurrence(once, localDate(2026, 8, 14, 12, 0)).getTime(), oneTimeAt.getTime());
assert.equal(nextAlarmOccurrence(once, localDate(2026, 8, 16, 12, 0)), null, 'Expired one-time alarms have no next occurrence.');

const dueAt = localDate(2026, 8, 13, 8, 30);
let claim = claimDueAlarms([daily], localDate(2026, 8, 13, 8, 34), 10 * 60 * 1000);
assert.deepEqual(claim.due.map((alarm) => alarm.id), ['daily-review'], 'A recently missed alarm rings after wake or timer throttling.');
assert.equal(new Date(claim.alarms[0].lastTriggeredAt).getTime(), dueAt.getTime());

claim = claimDueAlarms(claim.alarms, localDate(2026, 8, 13, 8, 35), 10 * 60 * 1000);
assert.equal(claim.due.length, 0, 'The same occurrence is never delivered twice.');

claim = claimDueAlarms([daily], localDate(2026, 8, 13, 8, 41), 10 * 60 * 1000);
assert.equal(claim.due.length, 0, 'An occurrence outside the recovery window is not delivered late.');

const snoozed = normalizeAlarm({
  ...daily,
  snoozedUntil:localDate(2026, 8, 13, 8, 44).toISOString(),
  lastTriggeredAt:dueAt.toISOString()
});
claim = claimDueAlarms([snoozed], localDate(2026, 8, 13, 8, 45), 10 * 60 * 1000);
assert.deepEqual(claim.due.map((alarm) => alarm.id), ['daily-review'], 'A snoozed alarm takes precedence over its regular schedule.');
assert.equal(claim.alarms[0].snoozedUntil, null, 'A delivered snooze is cleared.');

const expiredOnce = normalizeAlarm({
  id:'expired-once',
  name:'旧提醒',
  enabled:true,
  scheduleType:'once',
  onceAt:localDate(2026, 8, 13, 7, 0).toISOString(),
  time:'07:00'
});
claim = claimDueAlarms([expiredOnce], localDate(2026, 8, 13, 9, 0), 10 * 60 * 1000);
assert.equal(claim.due.length, 0);
assert.equal(claim.alarms[0].enabled, false, 'An expired one-time alarm is disabled even when it is too old to ring.');

assert.deepEqual(normalizeAlarms([daily, null, { name:'' }]).map((alarm) => alarm.id), ['daily-review']);
assert.match(formatAlarmSchedule(daily, 'zh-CN'), /每天/);
assert.match(formatAlarmSchedule(weekdays, 'en'), /Mon.*Wed.*Fri/);

const generated = normalizeAlarm({ name:'Auto ID', scheduleType:'unknown', time:null, snoozedUntil:'bad', lastTriggeredAt:'bad' });
assert.match(generated.id, /^alarm-/);
assert.equal(generated.scheduleType, 'daily');
assert.equal(generated.time, '08:00');
assert.equal(normalizeAlarm(null), null);
assert.equal(normalizeAlarm('alarm'), null);
assert.equal(nextAlarmOccurrence(null), null);
assert.equal(nextAlarmOccurrence(daily, 'not-a-date'), null);
assert.equal(nextAlarmOccurrence({ ...daily, enabled:false }, localDate(2026, 8, 13, 8, 0)), null);
assert.equal(nextAlarmOccurrence({ ...weekdays, weekdays:[] }, localDate(2026, 8, 13, 8, 0)), null);
assert.equal(
  nextAlarmOccurrence({ ...daily, snoozedUntil:localDate(2026, 8, 13, 8, 20).toISOString() }, localDate(2026, 8, 13, 8, 0)).getTime(),
  localDate(2026, 8, 13, 8, 20).getTime()
);
assert.equal(formatAlarmSchedule(null), '');
assert.equal(formatAlarmSchedule({ id:'once-missing', name:'Missing', scheduleType:'once', time:'08:00' }, 'en'), 'One time');
assert.match(formatAlarmSchedule(once, 'en'), /Aug/);

claim = claimDueAlarms([once], localDate(2026, 8, 15, 7, 46), 10 * 60 * 1000);
assert.deepEqual(claim.due.map((alarm) => alarm.id), ['flight']);
assert.equal(claim.alarms[0].enabled, false);
claim = claimDueAlarms([{ ...weekdays, time:'09:15' }], localDate(2026, 8, 13, 9, 20));
assert.equal(claim.due.length, 0, 'A weekday alarm does not fire on an unselected weekday.');
assert.equal(normalizeAlarms('invalid').length, 0);
assert.equal(normalizeAlarms([daily, daily]).length, 1);

const linked = normalizeAlarm({
  id:'linked-alarm',
  name:'提交周报',
  enabled:true,
  scheduleType:'daily',
  time:'18:00',
  todoId:'todo-weekly',
  linkedTodoText:'旧标题',
  snoozedUntil:localDate(2026, 8, 13, 18, 10).toISOString()
});
assert.equal(linked.todoId, 'todo-weekly', 'A valid todo ID is preserved on the alarm.');
assert.equal(linked.linkedTodoText, '旧标题');
assert.equal(normalizeAlarm({ ...linked, todoId:'bad id' }).todoId, '', 'Unsafe todo IDs cannot enter plugin data.');

let reconciled = reconcileTodoAlarms([linked, daily], [
  { id:'todo-weekly', text:'提交季度周报', done:false }
]);
assert.equal(reconciled[0].linkedTodoText, '提交季度周报', 'Renaming a todo updates the alarm link label.');
assert.equal(reconciled[0].enabled, true);
assert.equal(reconciled[1].enabled, true, 'Standalone alarms are unaffected by todo reconciliation.');

reconciled = reconcileTodoAlarms([linked], [
  { id:'todo-weekly', text:'提交周报', done:true }
]);
assert.equal(reconciled[0].enabled, false, 'Completing a todo disables its linked alarm.');
assert.equal(reconciled[0].snoozedUntil, null, 'Completing a todo cancels a pending snooze.');

reconciled = reconcileTodoAlarms([linked], []);
assert.equal(reconciled[0].enabled, false, 'Deleting a todo disables its linked alarm.');

const framework = fs.readFileSync(path.join(__dirname, '../src/_framework.js'), 'utf8');
const calendar = fs.readFileSync(path.join(__dirname, '../src/calendar.js'), 'utf8');
const pomodoro = fs.readFileSync(path.join(__dirname, '../src/pomodoro.js'), 'utf8');
const constants = fs.readFileSync(path.join(__dirname, '../src/constants.js'), 'utf8');
const build = fs.readFileSync(path.join(__dirname, '../build.js'), 'utf8');
assert.match(framework, /id:'alarms'[\s\S]*collapsible:true/, 'Alarm UI participates in module ordering, visibility, scenes, and collapse state.');
assert.match(framework, /this\.alarms\s*=\s*new AlarmService/, 'Alarm scheduling starts with the plugin rather than only when the dashboard view is open.');
assert.match(framework, /this\.alarms\?\.stop\(\)/, 'Plugin unload stops alarm timers and dismisses the overlay.');
assert.match(pomodoro, /pomodoroFullscreen/, 'Pomodoro exposes and persists the full-screen reminder option.');
assert.match(pomodoro, /showFullscreenReminder/, 'Pomodoro completion uses the shared full-screen reminder runtime.');
assert.match(pomodoro, /onStop:\s*startBreakFromReminder/, 'The focus-complete full-screen action starts the five-minute break.');
assert.match(pomodoro, /_pomodoroFullscreen\s*===\s*true\s*&&\s*self\._pomodoroBreakReminder\s*!==\s*false/, 'The break-complete full-screen reminder respects its own setting.');
assert.match(framework, /pluginData\?\.pomodoroBreakReminder\s*!==\s*false/, 'The break-complete reminder setting is restored with a backward-compatible default.');
assert.match(constants, /breakReminder[\s\S]*breakReminderHint/, 'Pomodoro exposes localized copy for the break-complete reminder setting.');
assert.match(framework, /openTodoAlarm/, 'Todo rows expose a direct create/edit alarm action.');
assert.match(framework, /syncTodos\(this\._todos\)/, 'Every successful dashboard todo mutation reconciles linked alarms.');
assert.match(framework, /todo-btn alarm/, 'Linked alarms have a visible state on todo rows.');
assert.match(calendar, /hasLinkedTodoAlarm\?\.\(todo\.raw\.id\)/, 'Calendar task rows show whether an alarm is already linked.');
assert.match(calendar, /onTodoAlarm\?\.\(todo\.raw\)/, 'Calendar task rows reuse the todo alarm editor action.');
assert.match(calendar, /cal-detail-alarm[\s\S]*alarm-clock/, 'Calendar task rows expose an alarm-clock action.');
assert.match(framework, /onTodoAlarm:\s*openTodoAlarm/, 'Calendar receives the shared todo alarm action from the dashboard.');
assert.match(build, /'alarm\.js'[\s\S]*'pomodoro\.js'/, 'The shared alarm runtime loads before Pomodoro.');

console.log('Alarm checks passed');
