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
  APPLE_CALENDAR_READ_JXA,
  expandAppleCalendarEvents,
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
const framework = fs.readFileSync(path.join(__dirname, '../src/_framework.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '../src/todo-editor.js'), 'utf8');
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

  let noOpStored = { appleCalendarSync:{ enabled:true, calendarId:'Cockpit', calendarName:'Cockpit', durationMinutes:30, mappings:{}, lastSyncResult:{ at:'2026-10-20T00:15:14.519Z', status:'failed', error:'stale failure' } } };
  let noOpCalls = 0;
  const noOpService = new AppleCalendarService({
    app:{ isMobile:false },
    async loadData() { return noOpStored; },
    async mutateData(mutator) { mutator(noOpStored); }
  }, { platform:'darwin', execFile:() => { noOpCalls += 1; throw new Error('An empty reconciliation must not launch Calendar'); } });
  assert.equal(await noOpService.syncTodos([], { silent:false }), true, 'An empty reconciliation succeeds without contacting Calendar.');
  assert.equal(noOpCalls, 0, 'No system script runs when there are no desired events or persisted mappings.');
  assert.equal(noOpStored.appleCalendarSync.lastSyncResult.status, 'success', 'A successful no-op clears a stale failure status.');

  let recoveryStored = { appleCalendarSync:{ enabled:true, calendarId:'Cockpit', calendarName:'Cockpit', durationMinutes:30,
    mappings:{ old:{ uid:'missing-event', calendarId:'Cockpit', hash:'old' } } } };
  const recoveryCalls = [];
  let recoveryListCount = 0;
  const recoveryExecFile = (file, args, options, callback) => {
    if (args[0] === '-e' && args[1] === APPLE_CALENDAR_LIST_SCRIPT) {
      recoveryListCount += 1;
      recoveryCalls.push({ type:'list' });
      callback(null, recoveryListCount === 1 ? 'Personal\n' : 'Personal\nCockpit\n', '');
      return;
    }
    if (args[0] === '-e' && args[1] === APPLE_CALENDAR_CREATE_SCRIPT) {
      recoveryCalls.push({ type:'create' });
      callback(null, 'Cockpit\n', '');
      return;
    }
    const payload = JSON.parse(args.at(-1));
    recoveryCalls.push({ type:'sync', payload });
    if (recoveryCalls.filter((call) => call.type === 'sync').length === 1) {
      const error = new Error('Command failed with a long embedded automation script');
      error.stderr = 'execution error: Error: calendar-not-found. (-2700)';
      callback(error, '', error.stderr);
      return;
    }
    callback(null, JSON.stringify({ mappings:{ recovered:{ uid:'event-recovered', calendarId:'Cockpit', hash:payload.desired[0]?.hash || '' } } }), '');
  };
  const recoveryService = new AppleCalendarService({
    app:{ isMobile:false },
    async loadData() { return recoveryStored; },
    async mutateData(mutator) { mutator(recoveryStored); }
  }, { platform:'darwin', execFile:recoveryExecFile });
  await recoveryService.syncTodos([{ id:'recovered', text:'恢复同步', tags:[], priority:'mid', done:false, calendarSync:true, dueHasTime:false, dueDate:localMomentLike('2026-10-21') }], { silent:false });
  assert.deepEqual(recoveryCalls.map((call) => call.type), ['sync','list','create','list','sync'], 'A missing configured calendar is recreated and the reconciliation is retried exactly once.');
  assert.deepEqual(recoveryCalls.at(-1).payload.mappings, {}, 'Mappings from the missing calendar are discarded before retrying against the replacement.');
  assert.equal(recoveryStored.appleCalendarSync.mappings.recovered.uid, 'event-recovered', 'The recovered synchronization persists only mappings returned by the replacement calendar.');

  let errorStored = { appleCalendarSync:{ enabled:true, calendarId:'Cockpit', calendarName:'Cockpit', durationMinutes:30, mappings:{} } };
  const errorService = new AppleCalendarService({
    app:{ isMobile:false },
    async loadData() { return errorStored; },
    async mutateData(mutator) { mutator(errorStored); }
  }, { platform:'darwin', execFile:(file, args, options, callback) => {
    if (args[0] === '-e') { callback(null, 'Cockpit\n', ''); return; }
    const error = new Error('Command failed: osascript -l JavaScript -e function run(argv) { /* hundreds of script characters */ }');
    error.stderr = 'execution error: Not authorized to send Apple events. (-1743)';
    callback(error, '', error.stderr);
  } });
  await assert.rejects(() => errorService.syncTodos([{ id:'denied', text:'权限测试', tags:[], priority:'mid', done:false, calendarSync:true, dueHasTime:false, dueDate:localMomentLike('2026-10-22') }], { silent:false }), /Command failed/);
  assert.match(errorStored.appleCalendarSync.lastSyncResult.error, /Not authorized to send Apple events.*-1743/, 'Persisted failures keep the actionable Calendar stderr and error code.');
  assert.doesNotMatch(errorStored.appleCalendarSync.lastSyncResult.error, /function run/, 'Persisted failures omit the embedded automation source.');

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

  // 只读日程：重复事件展开、排除日期、去重与时间窗裁剪。
  const local = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
  const iso = (ms) => new Date(ms).toISOString();
  const octStart = local(2026, 10, 1); const octEnd = local(2026, 11, 1);
  const weekly = {
    uid:'weekly-sync', title:'周会', calendar:'工作', allDay:false,
    startAt:iso(local(2026, 9, 7, 10)), endAt:iso(local(2026, 9, 7, 11)),
    recurrence:'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE', excluded:[iso(local(2026, 10, 14, 10))]
  };
  const expanded = expandAppleCalendarEvents([
    weekly,
    { uid:'single', title:'看牙', calendar:'个人', allDay:false, startAt:iso(local(2026, 10, 20, 15)), endAt:iso(local(2026, 10, 20, 16)) },
    { uid:'single', title:'看牙', calendar:'个人', allDay:false, startAt:iso(local(2026, 10, 20, 15)), endAt:iso(local(2026, 10, 20, 16)) },
    { uid:'outside', title:'去年', calendar:'个人', allDay:false, startAt:iso(local(2025, 1, 1, 9)), endAt:iso(local(2025, 1, 1, 10)) },
    { uid:'count', title:'三次课', calendar:'学习', allDay:false, startAt:iso(local(2026, 9, 29, 19)), endAt:iso(local(2026, 9, 29, 20)), recurrence:'FREQ=DAILY;COUNT=3' },
    { uid:'until', title:'月报', calendar:'工作', allDay:true, startAt:iso(local(2026, 8, 31)), endAt:iso(local(2026, 9, 1)), recurrence:'FREQ=MONTHLY;UNTIL=20261231T000000Z' }
  ], octStart, octEnd);
  const weeklyDays = expanded.filter((item) => item.uid === 'weekly-sync').map((item) => new Date(item.start).getDate());
  assert.deepEqual(weeklyDays, [5, 7, 12, 19, 21, 26, 28], 'Weekly BYDAY rules expand inside the window and honour excluded dates.');
  assert.equal(expanded.filter((item) => item.uid === 'single').length, 1, 'Duplicate event rows collapse to one occurrence.');
  assert.equal(expanded.some((item) => item.uid === 'outside'), false, 'Events outside the requested window are dropped.');
  assert.deepEqual(expanded.filter((item) => item.uid === 'count').map((item) => new Date(item.start).getDate()), [1], 'COUNT limits occurrences across the whole series.');
  assert.deepEqual(expanded.filter((item) => item.uid === 'until').map((item) => new Date(item.start).getDate()), [31], 'Monthly rules keep the anchor day (Sep 31 does not exist, Oct 31 does).');
  assert.ok(expanded.findIndex((item) => item.allDay) <= 0, 'All-day events sort first.');
  assert.doesNotMatch(APPLE_CALENDAR_READ_JXA, /calendarApp\.(?:delete|save)|events\.push|make new|\.Event\(/, 'The read script never creates, edits or deletes calendar data.');
  assert.match(APPLE_CALENDAR_READ_JXA, /records = query\.properties\(\)/, 'Filtered event properties are fetched in one Calendar bridge call.');
  assert.match(APPLE_CALENDAR_READ_JXA, /event\.properties\(\)/, 'Older Calendar bridges retain a per-event property-record fallback.');
  assert.doesNotMatch(APPLE_CALENDAR_READ_JXA, /query\[prop\]\(\)/, 'Calendar filters are not rerun separately for each property.');
  assert.equal(normalizeAppleCalendarConfig({}).showEvents, false, 'System events stay hidden until the user opts in.');
  const readCalls = [];
  let readerStored = { appleCalendarSync:{ showEvents:true, enabled:true, calendarName:'Cockpit', calendarId:'Cockpit', hiddenCalendars:['节假日'] } };
  const readerPlugin = { loadData:async () => readerStored, mutateData:async (mutator) => { mutator(readerStored); } };
  const reader = new AppleCalendarService(readerPlugin, {
    platform:'darwin',
    execFile:(command, args, options, callback) => { readCalls.push(JSON.parse(args[4])); callback(null, JSON.stringify({ events:[{ uid:'a', title:'评审', calendar:'工作', startAt:iso(local(2026, 10, 9, 14)), endAt:iso(local(2026, 10, 9, 15)) }] }), ''); }
  });
  const firstRead = await reader.readEvents(octStart, octEnd);
  await reader.readEvents(octStart, octEnd);
  assert.equal(firstRead.length, 1);
  assert.equal(readCalls.length, 1, 'Event reads are cached per window.');
  assert.deepEqual(readCalls[0].hidden, ['节假日', 'Cockpit'], 'Hidden calendars and the managed Cockpit calendar are excluded from reads.');
  assert.equal(readerStored.appleCalendarEventCache.events[0].title, '评审', 'The latest read-only result is persisted locally for instant reloads.');
  const restoredReader = new AppleCalendarService(readerPlugin, { platform:'darwin', execFile:() => { throw new Error('fresh cache must not launch a system query'); } });
  assert.equal((await restoredReader.readEvents(octStart, octEnd))[0].title, '评审', 'A new plugin instance restores a fresh event window without waiting for Calendar.');
  await restoredReader.clearEventCache();
  assert.equal(readerStored.appleCalendarEventCache, undefined, 'Clearing calendar events removes the local persisted cache.');
  const disabledReader = new AppleCalendarService({ loadData:async () => ({}) }, { platform:'darwin', execFile:() => { throw new Error('must not run'); } });
  assert.deepEqual(await disabledReader.readEvents(octStart, octEnd), [], 'No system script runs while event display is off.');

  console.log('Apple calendar checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
