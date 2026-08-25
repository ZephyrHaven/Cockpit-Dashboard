#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// User journey 1: opening the dashboard should turn pending work into a
// predictable Today queue instead of one long, manually filtered list.
// User journey 2: a Pomodoro can be attached to a todo and its per-task focus
// total survives in plugin data without creating another _data Markdown file.

const root = path.resolve(__dirname, '..');
const api = require(path.join(root, 'src/todo-focus.js'));
const { mutatePluginData } = require(path.join(root, 'src/data-store.js'));
const due = (key) => ({ format: () => key });

const todos = [
  { id:'over-mid', text:'Overdue middle', done:false, priority:'mid', dueDate:due('2026-08-10') },
  { id:'over-high', text:'Overdue high', done:false, priority:'high', dueDate:due('2026-08-11') },
  { id:'today-low', text:'Today low', done:false, priority:'low', dueDate:due('2026-08-12') },
  { id:'future-high', text:'Important later', done:false, priority:'high', dueDate:due('2026-08-18') },
  { id:'inbox', text:'Unscheduled', done:false, priority:'mid', dueDate:null },
  { id:'future-mid', text:'Future normal', done:false, priority:'mid', dueDate:due('2026-08-18') },
  { id:'done', text:'Already done', done:true, priority:'high', dueDate:due('2026-08-10') }
];

const groups = api.groupTodayTodos(todos, '2026-08-12');
assert.deepEqual(Array.from(groups, (group) => group.key), ['overdue', 'today', 'priority', 'inbox']);
assert.deepEqual(Array.from(groups[0].items, (todo) => todo.id), ['over-high', 'over-mid'], 'Overdue work is sorted by priority.');
assert.deepEqual(Array.from(groups[1].items, (todo) => todo.id), ['today-low']);
assert.deepEqual(Array.from(groups[2].items, (todo) => todo.id), ['future-high']);
assert.deepEqual(Array.from(groups[3].items, (todo) => todo.id), ['inbox']);
assert.equal(groups.flatMap((group) => Array.from(group.items)).some((todo) => todo.id === 'future-mid'), false, 'Ordinary future work stays out of Today.');
assert.equal(groups.flatMap((group) => Array.from(group.items)).some((todo) => todo.done), false, 'Completed work stays out of Today.');

const sequence = ['todo-a', 'todo-b', 'todo-c'];
const withIds = api.ensureTodoIds([
  { text:'Keep me', id:'existing-id' },
  { text:'Assign me' },
  { text:'Duplicate', id:'existing-id' }
], () => sequence.shift());
assert.deepEqual(Array.from(withIds, (todo) => todo.id), ['existing-id', 'todo-a', 'todo-b'], 'Todo IDs are stable and unique.');
const repairedIds = api.ensureTodoIds([
  { text:'First', id:'same-id' },
  { text:'Duplicate', id:'same-id' },
  { text:'Too long', id:'x'.repeat(73) },
  { text:'Reserved', id:'__proto__' }
], (() => { const ids = ['fixed-1', 'fixed-2', 'fixed-3']; return () => ids.shift(); })());
assert.deepEqual(Array.from(repairedIds, (todo) => todo.id), ['same-id', 'fixed-1', 'fixed-2', 'fixed-3'], 'Duplicate and invalid persisted IDs are repaired.');

const ref = api.pomodoroTaskRef({ id:'task-1', text:'Ship dashboard', done:false });
assert.deepEqual({ ...ref }, { id:'task-1', text:'Ship dashboard' });
assert.equal(api.pomodoroTaskRef({ id:'task-2', text:'Done', done:true }), null, 'Completed tasks cannot be newly bound.');
assert.equal(api.canChangePomodoroTask(false, false, ref, { id:'task-2' }), true, 'A fresh idle timer can change its linked task.');
assert.equal(api.canChangePomodoroTask(true, true, ref, { id:'task-2' }), false, 'A running timer cannot be rebound to another task.');
assert.equal(api.canChangePomodoroTask(false, true, ref, { id:'task-2' }), false, 'A paused timer with progress cannot transfer the session to another task.');
assert.equal(api.canChangePomodoroTask(true, true, ref, { id:'task-1' }), true, 'Selecting the current task while running is harmless.');

let stats = api.recordPomodoroTaskFocus({}, ref, 25, '2026-08-12T10:00:00.000Z');
stats = api.recordPomodoroTaskFocus(stats, ref, 25, '2026-08-12T11:00:00.000Z');
assert.deepEqual({ ...stats['task-1'] }, {
  taskId:'task-1',
  text:'Ship dashboard',
  totalMinutes:50,
  sessions:2,
  lastFocusedAt:'2026-08-12T11:00:00.000Z'
});
assert.deepEqual({ ...api.getTodoFocusStat(stats, { id:'task-1' }) }, { ...stats['task-1'] });
assert.equal(api.getTodoFocusStat(stats, { id:'missing' }), null);
const guardedStats = { 'task-1':stats['task-1'] };
Object.defineProperty(guardedStats, 'unrelated', { enumerable:true, get() { throw new Error('unrelated focus stats should not be scanned'); } });
assert.equal(api.getTodoFocusStat(guardedStats, { id:'task-1' }).totalMinutes, 50, 'Rendering one task performs an O(1) stat lookup.');
const prototypeNamedStats = api.recordPomodoroTaskFocus({}, { id:'toString', text:'Prototype-safe task' }, 25, '2026-08-12T12:00:00.000Z');
assert.deepEqual(Object.keys(prototypeNamedStats), [], 'Prototype property names are rejected as persisted IDs.');

const noisy = {};
for (let i = 0; i < 5010; i++) {
  noisy['task-' + i] = { taskId:'task-' + i, text:'Task ' + i, totalMinutes:i + 1, sessions:1, lastFocusedAt:new Date(2026, 0, 1, 0, i).toISOString() };
}
const normalized = api.normalizePomodoroTaskStats(noisy);
assert.equal(Object.keys(normalized).length, 1000, 'Per-task focus data stays bounded inside data.json.');
assert.ok(normalized['task-5009'], 'The newest task focus entry is retained.');
assert.equal(normalized['task-0'], undefined, 'The oldest task focus entry is pruned.');

const completionInput = {
  id:'focus-once', day:'2026-08-12', minutes:25, currentFocusMinutes:50,
  task:ref, completedAt:'2026-08-12T13:00:00.000Z'
};
const firstCompletion = api.recordPomodoroCompletion({}, [], completionInput);
const duplicateCompletion = api.recordPomodoroCompletion(firstCompletion.stats, firstCompletion.completions, completionInput);
assert.equal(firstCompletion.isNew, true);
assert.equal(duplicateCompletion.isNew, false, 'A recovered completion ID cannot double-credit task focus.');
assert.equal(duplicateCompletion.stats['task-1'].sessions, 1);
assert.equal(firstCompletion.entry.targetMinutes, 75);
const appliedCompletions = api.markPomodoroCompletionsApplied(firstCompletion.completions, ['focus-once']);
assert.equal(appliedCompletions[0].appliedToFocusHistory, true, 'The cross-file completion is marked only after focus.md succeeds.');

const benchmarkTodos = Array.from({ length:5000 }, (_, index) => ({
  id:'bench-' + index,
  text:'Task ' + index,
  done:false,
  priority:index % 17 === 0 ? 'high' : 'mid',
  dueDate:index % 5 === 0 ? due('2026-08-12') : null
}));
const startedAt = Date.now();
const benchmarkGroups = api.groupTodayTodos(benchmarkTodos, '2026-08-12');
assert.equal(benchmarkGroups.flatMap((group) => group.items).length > 0, true);
assert.ok(Date.now() - startedAt < 500, 'A 5k-task Today queue remains responsive.');
const limitedBenchmark = api.limitTodoGroups(benchmarkGroups, 120);
assert.equal(limitedBenchmark.rendered, 120, 'A 5k-task queue only creates the first bounded DOM batch.');
assert.equal(limitedBenchmark.hasMore, true);
assert.equal(limitedBenchmark.total > limitedBenchmark.rendered, true);

const buildSource = fs.readFileSync(path.join(root, 'build.js'), 'utf8');
const frameworkSource = fs.readFileSync(path.join(root, 'src/_framework.js'), 'utf8');
const pomodoroSource = fs.readFileSync(path.join(root, 'src/pomodoro.js'), 'utf8');
const calendarSource = fs.readFileSync(path.join(root, 'src/calendar.js'), 'utf8');
const todoSource = fs.readFileSync(path.join(root, 'src/todos.js'), 'utf8');
const stylesSource = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const dataStoreSource = fs.readFileSync(path.join(root, 'src/data-store.js'), 'utf8');
assert.match(buildSource, /'todo-focus\.js'/, 'The shared feature logic is part of the plugin bundle.');
assert.match(buildSource, /'data-store\.js'/, 'All plugin data mutations share one bundled queue.');
assert.match(frameworkSource, /currentStatus\s*=\s*'today'/, 'Today is the useful default task view.');
assert.match(frameworkSource, /groupTodayTodos\(/, 'The task UI renders the tested Today queue.');
assert.equal((frameworkSource.match(/groupTodayTodos\(/g) || []).length, 1, 'A Today render groups and sorts its queue only once.');
assert.match(frameworkSource, /pomodoroTaskStats/, 'Per-task totals are loaded from existing plugin data.');
assert.match(dataStoreSource, /plugin\._cockpitDataWrite/, 'Plugin data mutations are serialized across dashboard views and services.');
assert.match(frameworkSource, /_commitPomodoroCompletion[\s\S]*?recordPomodoroCompletion/, 'Focus completion, task attribution, and the next session share an idempotent commit.');
assert.match(frameworkSource, /statusSelect\.onchange[\s\S]*?renderTodos\(\{\s*persist:false\s*\}\)/, 'Changing filters never rewrites todos.md.');
assert.match(frameworkSource, /_applyPomodoroTaskAction[\s\S]*?await mutateTodos\(this\.app\.vault/, 'Floating timer actions atomically update the latest todos instead of overwriting a stale view.');
assert.match(frameworkSource, /if \(!outcome\.saved \|\| !outcome\.todos\) return false/, 'A failed todos.md transaction never reports task completion.');
assert.match(frameworkSource, /baseTodayGroups\.map[\s\S]*?items:activeTag \? group\.items\.filter/, 'Today summary and batch actions reuse the queue within the active tag filter.');
assert.match(frameworkSource, /limitTodoGroups\(todayGroups, todoRenderLimit\)/, 'Today rendering uses the tested bounded batch instead of building thousands of rows.');
assert.match(pomodoroSource, /pomodoro-task-select/, 'The timer exposes a compact todo picker.');
assert.match(pomodoroSource, /_commitPomodoroCompletion/, 'A completed focus session updates per-task totals idempotently.');
assert.match(pomodoroSource, /aria-live/, 'Timer completion and linked-task actions are announced accessibly.');
assert.match(pomodoroSource, /if \(boundTask && !options\.some\(\(todo\) => todo\.id === boundTask\.id\)\)/, 'A deleted or completed linked task is cleared instead of remaining selectable.');
assert.match(pomodoroSource, /_cockpitPomodoroFeatureVersion/, 'Hot upgrades detect an incompatible old floating timer without spawning a ghost timer.');
assert.doesNotMatch(pomodoroSource, /self\._updateStatsRef\s*=\s*null/, 'Opening Pomodoro must keep the live dashboard stats callback.');
assert.match(todoSource, /'id:' \+ t\.id/, 'Stable todo IDs stay in the existing todos.md file.');
assert.match(todoSource, /queueTodoFileMutation/, 'Todo ID migration serializes read, repair, and write.');
assert.match(stylesSource, /today-group/, 'Today queue grouping has dedicated responsive styling.');
assert.match(frameworkSource, /today-group-actions[\s\S]*Complete all|today-group-actions[\s\S]*全部完成/, 'Today groups expose batch completion.');
assert.match(frameworkSource, /application\/x-cockpit-todo/, 'Tasks can be dragged onto the calendar for scheduling.');
assert.match(calendarSource, /cal-week[\s\S]*add\(offset, 'day'\)/, 'Calendar provides a seven-day week view.');
assert.match(frameworkSource, /createEl\('button', \{ cls: PLUGIN_ID\+'-todo-chk'/, 'Task completion controls use native keyboard-operable buttons.');
const directDataSaves = fs.readdirSync(path.join(root, 'src')).filter((name) => name.endsWith('.js')).filter((name) => {
  if (name === 'data-store.js') return false;
  return /\.saveData\(/.test(fs.readFileSync(path.join(root, 'src', name), 'utf8'));
});
assert.deepEqual(directDataSaves, [], 'No service can bypass the shared data.json mutation queue.');

const todoContext = vm.createContext({
  console:{ warn:() => {} },
  TODO_FILE:'_data/todos.md',
  ensureTodoIds:api.ensureTodoIds,
  parseDate:(value) => ({ value, format:() => value }),
  extractTags:(text) => ({ cleanText:text, tags:[], dueDate:null, priority:'mid' })
});
vm.runInContext(todoSource + '\nglobalThis.saveTodosForTest = saveTodos; globalThis.loadTodosForTest = loadTodos; globalThis.mutateTodosForTest = mutateTodos;', todoContext);
const writableFile = { path:'_data/todos.md' };
const sampleTodo = [{ id:'save-test', text:'Persist safely', tags:[], priority:'mid', dueDate:null, done:false, created:null, doneDate:null }];
(async () => {
  let persistedData = {};
  const plugin = {
    async loadData() { return { ...persistedData }; },
    async saveData(data) { persistedData = { ...data }; }
  };
  await Promise.all([
    mutatePluginData(plugin, async (data) => {
      data.collapsed = { todos:true };
      await new Promise((resolve) => setTimeout(resolve, 20));
    }),
    mutatePluginData(plugin, (data) => {
      data.pomodoroTaskStats = { task:{ taskId:'task', totalMinutes:25, sessions:1 } };
    })
  ]);
  assert.equal(persistedData.collapsed.todos, true);
  assert.equal(persistedData.pomodoroTaskStats.task.totalMinutes, 25, 'Concurrent settings and focus writes retain both fields.');

  const originalDue = due('2026-08-10');
  const rollbackTodo = { id:'rollback', text:'Keep date', done:false, dueDate:originalDue };
  const deferred = await api.deferTodosToDate([rollbackTodo], due('2026-08-13'), async () => false);
  assert.equal(deferred, false);
  assert.equal(rollbackTodo.dueDate, originalDue, 'Failed batch defer rolls every in-memory date back.');

  let migratedContent = '# 待办事项\n\n<!-- keep this note -->\n- [ ] First | id:same | owner:alice\n- [ ] Duplicate | id:same\n- [ ] Invalid | id:bad!\n';
  let migrationWrites = 0;
  const migrationFile = { path:'_data/todos.md' };
  const migrationVault = {
    getAbstractFileByPath:(filePath) => filePath === '_data/todos.md' ? migrationFile : (filePath === '_data' ? {} : null),
    read:async () => migratedContent,
    modify:async (_file, content) => { migrationWrites++; migratedContent = content; }
  };
  const firstLoad = await todoContext.loadTodosForTest(migrationVault);
  const firstIds = Array.from(firstLoad, (todo) => todo.id);
  assert.equal(new Set(firstIds).size, 3);
  assert.equal(firstIds.every(Boolean), true);
  const secondLoad = await todoContext.loadTodosForTest(migrationVault);
  assert.deepEqual(Array.from(secondLoad, (todo) => todo.id), firstIds, 'Repaired IDs survive a load-save-load round trip.');
  assert.equal(migrationWrites, 1, 'ID migration writes the existing todos.md only once.');
  assert.match(migratedContent, /<!-- keep this note -->/);
  assert.match(migratedContent, /owner:alice/, 'ID migration preserves comments and unrelated metadata.');

  let emptyLineContent = '# 待办事项\n\n- [ ] \n- [ ] Real task\n';
  const emptyLineVault = {
    getAbstractFileByPath:(filePath) => filePath === '_data/todos.md' ? migrationFile : (filePath === '_data' ? {} : null),
    read:async () => emptyLineContent,
    modify:async (_file, content) => { emptyLineContent = content; }
  };
  const emptyLineTodos = await todoContext.loadTodosForTest(emptyLineVault);
  assert.match(emptyLineContent.split('\n')[3], /id:/, 'ID migration skips empty checkbox lines and patches the parsed task.');
  assert.equal(emptyLineTodos.length, 1);

  const failedMigrationVault = {
    getAbstractFileByPath:(filePath) => filePath === '_data/todos.md' ? migrationFile : (filePath === '_data' ? {} : null),
    read:async () => '# 待办事项\n\n- [ ] Missing id\n',
    modify:async () => { throw new Error('disk full'); }
  };
  const failedMigration = await todoContext.loadTodosForTest(failedMigrationVault);
  assert.equal(failedMigration[0].id, '', 'An ID that failed to persist is never exposed as stable.');

  let atomicContent = '# 待办事项\n\n- [ ] Alpha | id:alpha\n- [ ] Beta | id:beta\n';
  const atomicVault = {
    getAbstractFileByPath:(filePath) => filePath === '_data/todos.md' ? migrationFile : (filePath === '_data' ? {} : null),
    read:async () => atomicContent,
    modify:async (_file, content) => { atomicContent = content; }
  };
  await Promise.all([
    todoContext.mutateTodosForTest(atomicVault, async (items) => {
      items.find((item) => item.id === 'alpha').done = true;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return true;
    }),
    todoContext.mutateTodosForTest(atomicVault, (items) => {
      items.find((item) => item.id === 'beta').done = true;
      return true;
    })
  ]);
  const atomicReload = await todoContext.loadTodosForTest(atomicVault);
  assert.equal(atomicReload.every((todo) => todo.done), true, 'Concurrent task actions merge through one todos.md transaction queue.');

  const saved = await todoContext.saveTodosForTest({
    getAbstractFileByPath:() => writableFile,
    modify:async () => {}
  }, sampleTodo);
  assert.equal(saved, true, 'Todo writes report success.');
  const failed = await todoContext.saveTodosForTest({
    getAbstractFileByPath:() => writableFile,
    modify:async () => { throw new Error('disk full'); }
  }, sampleTodo);
  assert.equal(failed, false, 'Todo writes surface failure instead of silently succeeding.');

  const pendingRecovery = api.recordPomodoroCompletion({}, [], completionInput).completions;
  let focusWriteAttempts = 0;
  let appliedIds = [];
  const failedReplay = await api.replayPomodoroCompletions(pendingRecovery, async () => {
    focusWriteAttempts++;
    throw new Error('focus.md unavailable');
  }, async (ids) => { appliedIds = ids; });
  assert.equal(failedReplay.appliedIds.length, 0);
  assert.deepEqual(appliedIds, [], 'A failed focus.md write leaves the completion pending for restart recovery.');
  const successfulReplay = await api.replayPomodoroCompletions(pendingRecovery, async (_day, target) => target, async (ids) => { appliedIds = ids; });
  assert.deepEqual(appliedIds, ['focus-once']);
  assert.equal(successfulReplay.focusByDay.get('2026-08-12'), 75, 'Restart recovery applies the journal target exactly once.');
  console.log('Today queue and task-bound Pomodoro checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
