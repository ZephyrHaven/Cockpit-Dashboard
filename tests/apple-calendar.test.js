#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeAppleCalendarConfig,
  buildAppleCalendarDesiredEvents,
  appleCalendarAutomationMessage,
  APPLE_CALENDAR_CREATE_SCRIPT,
  APPLE_CALENDAR_LIST_SCRIPT,
  APPLE_CALENDAR_JXA,
  AppleCalendarService
} = require('../src/apple-calendar.js');

function localMomentLike(value) {
  return {
    format(pattern) {
      if (pattern === 'YYYY-MM-DD') return value.slice(0, 10);
      if (pattern === 'YYYY-MM-DDTHH:mm:ss') return value.length > 10 ? value : value + 'T00:00:00';
      throw new Error('Unexpected format: ' + pattern);
    }
  };
}

const config = normalizeAppleCalendarConfig({
  enabled:true,
  calendarId:'icloud-work',
  calendarName:'Cockpit',
  durationMinutes:30,
  mappings:{
    'todo-valid':{ uid:'event-123', calendarId:'icloud-work', hash:'abc' },
    '../../bad':{ uid:'event-unsafe', calendarId:'icloud-work', hash:'bad' }
  }
});
assert.equal(config.enabled, true);
assert.equal(config.durationMinutes, 30);
assert.deepEqual(Object.keys(config.mappings), ['todo-valid'], 'Unsafe task IDs are never persisted as calendar mapping keys.');

const desired = buildAppleCalendarDesiredEvents([
  { id:'all-day', text:'准备周报', tags:['工作'], priority:'high', done:false, calendarSync:true, dueHasTime:false, dueDate:localMomentLike('2026-09-03') },
  { id:'timed', text:'客户电话', tags:[], priority:'mid', done:false, calendarSync:true, dueHasTime:true, dueDate:localMomentLike('2026-09-03T16:00:00') },
  { id:'not-selected', text:'不要同步', tags:[], priority:'mid', done:false, calendarSync:false, dueHasTime:false, dueDate:localMomentLike('2026-09-04') },
  { id:'done', text:'已完成', done:true, calendarSync:true, dueHasTime:false, dueDate:localMomentLike('2026-09-04') },
  { id:'undated', text:'没有日期', done:false, calendarSync:true, dueDate:null }
], config);

assert.equal(desired.length, 2, 'Only explicitly selected, open tasks with a due date are synchronized.');
assert.equal(desired.some((item) => item.todoId === 'not-selected'), false, 'Dated tasks stay local unless their calendar checkbox is selected.');
assert.deepEqual(desired[0], {
  todoId:'all-day', title:'准备周报', startAt:'2026-09-03T00:00:00', endAt:'2026-09-04T00:00:00', allDay:true,
  notes:'由 Cockpit 管理\nCockpit task ID: all-day\n标签: #工作\n优先级: high'
});
assert.equal(desired[1].startAt, '2026-09-03T16:00:00');
assert.equal(desired[1].endAt, '2026-09-03T16:30:00');
assert.equal(desired[1].allDay, false);

assert.match(APPLE_CALENDAR_JXA, /JSON\.parse\(argv\[0\]\)/, 'The fixed automation script accepts data through a JSON argv payload.');
assert.doesNotMatch(APPLE_CALENDAR_JXA, /shell|eval\s*\(/i, 'The automation script never evaluates task text or invokes a shell.');
assert.match(APPLE_CALENDAR_JXA, /calendars\.byName/, 'Event synchronization resolves the dedicated calendar by its readable name on systems where calendarIdentifier is broken.');
assert.doesNotMatch(APPLE_CALENDAR_JXA, /calendars\.(?:map|find)/, 'Event synchronization never coerces unrelated Calendar objects while locating the target.');
assert.equal(typeof APPLE_CALENDAR_LIST_SCRIPT, 'string', 'Calendar discovery uses a dedicated AppleScript instead of coercing Calendar objects through JXA.');
assert.doesNotMatch(APPLE_CALENDAR_LIST_SCRIPT || '', /calendarIdentifier/, 'Calendar discovery avoids the broken calendarIdentifier property.');
assert.match(APPLE_CALENDAR_LIST_SCRIPT || '', /name of calendarRef/, 'Calendar discovery falls back to the readable calendar name.');
assert.equal(typeof APPLE_CALENDAR_CREATE_SCRIPT, 'string', 'Automatic setup ships a fixed script for creating the dedicated calendar.');
assert.match(APPLE_CALENDAR_CREATE_SCRIPT || '', /make new calendar with properties \{name:"Cockpit"\}/, 'Automatic setup creates only the dedicated Cockpit calendar.');

const build = fs.readFileSync(path.join(__dirname, '../build.js'), 'utf8');
const framework = fs.readFileSync(path.join(__dirname, '../src/_framework.js'), 'utf8');
const settings = fs.readFileSync(path.join(__dirname, '../src/serverchan.js'), 'utf8');
assert.match(build, /'apple-calendar\.js'/, 'The Apple calendar service ships in the production bundle.');
assert.match(framework, /new AppleCalendarService\(this\)/, 'The plugin owns one Apple calendar synchronization service.');
assert.match(framework, /appleCalendar\?\.syncTodos/, 'Todo mutations enqueue Apple calendar reconciliation.');
assert.match(framework, /同步到 iPhone 日历/, 'The todo editor exposes an explicit per-task calendar checkbox.');
assert.match(framework, /calendarSync:\s*draft\.calendarSync/, 'The todo editor persists the per-task synchronization choice.');
assert.match(framework, /draft\.calendarSync[\s\S]{0,180}ensureReady/, 'Saving the first selected task initializes Apple Calendar automatically.');
assert.match(framework, /this\._todos\.some\(\(todo\) => todo\?\.calendarSync === true[\s\S]{0,600}ensureReady/, 'Startup recovers tasks that were selected before automatic setup was available.');
assert.match(settings, /仅 Mac 可用/, 'Settings clearly state that Apple synchronization is available only on Mac.');
assert.match(settings, /listCalendars/, 'Calendar access is requested only from an explicit settings action.');
assert.match(settings, /ensureReady/, 'Enabling the channel initializes a target calendar instead of demanding a prior manual selection.');
assert.doesNotMatch(settings, /请先读取并选择一个可写日历/, 'The settings UI no longer traps users in a read-before-enable loop.');

(async () => {
  let stored = { appleCalendarSync:{ enabled:true, calendarId:'Cockpit', calendarName:'Cockpit', durationMinutes:30, mappings:{} } };
  const plugin = {
    app:{ isMobile:false },
    async loadData() { return stored; },
    async mutateData(mutator) { mutator(stored); }
  };
  const calls = [];
  const fakeExecFile = (file, args, options, callback) => {
    if (args[0] === '-e' && args[1] === APPLE_CALENDAR_LIST_SCRIPT) {
      calls.push({ file, args, options, payload:null });
      callback(null, 'Cockpit\nPersonal\n', '');
      return;
    }
    const payload = JSON.parse(args.at(-1));
    calls.push({ file, args, options, payload });
    callback(null, JSON.stringify({ mappings:{ timed:{ uid:'event-timed', calendarId:'icloud-work', hash:payload.desired[0]?.hash || '' } } }), '');
  };
  const service = new AppleCalendarService(plugin, { platform:'darwin', execFile:fakeExecFile });
  const calendars = await service.listCalendars();
  assert.deepEqual(calendars, [
    { id:'Cockpit', name:'Cockpit', writable:true },
    { id:'Personal', name:'Personal', writable:true }
  ]);
  assert.equal(calls[0].file, 'osascript');
  assert.deepEqual(calls[0].args.slice(0, 2), ['-e',APPLE_CALENDAR_LIST_SCRIPT]);

  await service.syncTodos([{ id:'timed', text:'客户电话', tags:[], priority:'mid', done:false, calendarSync:true, dueHasTime:true, dueDate:localMomentLike('2026-09-03T16:00:00') }], { silent:false });
  assert.equal(calls[1].payload.action, 'sync');
  assert.equal(calls[1].payload.calendarName, 'Cockpit');
  assert.equal(calls[1].payload.desired[0].title, '客户电话');
  assert.equal(stored.appleCalendarSync.mappings.timed.uid, 'event-timed', 'Successful sync persists the system event UID through the shared data queue.');

  let setupStored = {};
  let listCount = 0;
  const setupCalls = [];
  const setupPlugin = {
    app:{ isMobile:false },
    async loadData() { return setupStored; },
    async mutateData(mutator) { mutator(setupStored); }
  };
  const setupExecFile = (file, args, options, callback) => {
    setupCalls.push({ file, args, options });
    if (args[1] === APPLE_CALENDAR_LIST_SCRIPT) {
      listCount += 1;
      callback(null, listCount === 1 ? 'Personal\n' : 'Personal\nCockpit\n', '');
      return;
    }
    if (args[1] === APPLE_CALENDAR_CREATE_SCRIPT) {
      callback(null, 'Cockpit\n', '');
      return;
    }
    callback(new Error('unexpected script'), '', '');
  };
  const setupService = new AppleCalendarService(setupPlugin, { platform:'darwin', execFile:setupExecFile });
  const ready = await setupService.ensureReady({ enable:true });
  assert.equal(ready.enabled, true, 'First-use setup enables the Apple Calendar channel.');
  assert.equal(ready.calendarName, 'Cockpit', 'First-use setup selects the dedicated calendar.');
  assert.equal(ready.calendarId, 'Cockpit', 'Name-based fallback persists a usable target on affected systems.');
  assert.equal(setupCalls.filter((call) => call.args[1] === APPLE_CALENDAR_CREATE_SCRIPT).length, 1, 'Missing dedicated calendars are created automatically once.');

  listCount = 1;
  setupCalls.length = 0;
  setupStored.appleCalendarSync.enabled = false;
  const reused = await setupService.ensureReady({ enable:true });
  assert.equal(reused.enabled, true);
  assert.equal(setupCalls.some((call) => call.args[1] === APPLE_CALENDAR_CREATE_SCRIPT), false, 'Existing dedicated calendars are reused without duplicate creation.');

  const unsupported = new AppleCalendarService(plugin, { platform:'linux', execFile:fakeExecFile });
  await assert.rejects(() => unsupported.listCalendars(), /unsupported-platform/);
  assert.match(appleCalendarAutomationMessage(new Error('unsupported-platform'), 'zh-CN'), /仅 Mac 可用/);
  assert.match(appleCalendarAutomationMessage({ stderr:'Not authorized to send Apple events. (-1743)' }, 'zh-CN'), /隐私与安全性/);

  console.log('Apple calendar checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
