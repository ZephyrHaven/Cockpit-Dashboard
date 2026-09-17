const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const handlers = new Map(), timers = new Map(); let timerId = 0;
const context = vm.createContext({ console:{ warn:() => {} }, Date, Set, WeakMap, Map, HTMLElement:class {},
  PLUGIN_ID:'cockpit-dashboard', TODO_FILE:'_data/todos.md', FOCUS_FILE:'_data/focus.md', HABIT_FILE:'_data/habits.md',
  document:{ hidden:false, activeElement:null },
  window:{ moment:() => ({ format:() => '2026-09-17' }),
    setTimeout:(fn) => { timers.set(++timerId, fn); return timerId; }, clearTimeout:(id) => timers.delete(id) },
  parseTodosContent:(content) => [{ text:content }], serializeTodos:(todos) => todos.map((todo) => todo.text).join(','),
  loadTodos:async () => [{ id:'external', text:'Latest external edit' }] });
vm.runInContext(fs.readFileSync('src/silent-refresh.js', 'utf8')
  + '\nthis.api={cockpitRunSilentRefreshCycle,cockpitRegisterVaultRefreshEvents,cockpitMarkManagedWrite};', context);

(async () => {
  const calls = {};
  const count = (key) => { calls[key] = (calls[key] || 0) + 1; };
  let root = {}, content = 'external', active = 0, peak = 0, release;
  const vault = { on:(event, fn) => { handlers.set(event, fn); return {}; }, cachedRead:async () => content,
    getMarkdownFiles:() => { count('files'); return []; }, getAbstractFileByPath:() => ({}), read:async () => 'focus' };
  const view = { app:{ vault }, registerEvent:() => {}, _plugin:{ alarms:{ syncTodos:async () => {} } },
    containerEl:{ children:[{}, { querySelector:() => root }] },
    _refreshHeroSection:() => {}, _reloadDashboardState:async () => { count('reload'); },
    _updateStatsRef:() => count('stats'), _refreshRecentSection:() => count('recent'), _refreshBookmarkSection:async () => count('bookmarks'),
    _rebuildRecentStars:() => {}, _refreshCalendarRef:() => count('calendar'), _refreshFocusChartRef:() => count('chart'),
    _refreshTodosRef:async () => { count('todos'); }, _refreshProjectsRef:() => {}, _refreshAgendaRef:() => {}, _refreshWeeklyReviewRef:() => {},
    _parseFocusHistory:() => new Map([['2026-09-17', 50]]) };
  await context.api.cockpitRunSilentRefreshCycle(view, { scopes:['notes'], ignoreRecentActivity:true });
  assert.equal(calls.reload || 0, 0, 'Ordinary note changes do not reload plugin settings or tasks.');
  assert.equal(calls.todos || 0, 0);
  assert.equal(calls.chart || 0, 0);
  assert.equal(calls.recent, 1);
  await context.api.cockpitRunSilentRefreshCycle(view, { scopes:['focus'], ignoreRecentActivity:true });
  assert.equal(view._focusMinutes, 50);
  assert.equal(calls.chart, 1);
  assert.equal(calls.recent, 1, 'Focus edits leave file lists alone.');

  context.api.cockpitRegisterVaultRefreshEvents(view);
  assert.equal(handlers.has('create'), true, 'New notes are observed as well as edits.');
  const file = { path:'_data/todos.md', extension:'md' };
  view._todos = [{ text:'self' }];
  context.api.cockpitMarkManagedWrite(vault, file.path, 'self'); content = 'self';
  await handlers.get('modify')(file);
  assert.equal(timers.size, 0, 'Exactly matching self-writes avoid redundant refreshes.');
  content = 'external'; await handlers.get('modify')(file);
  assert.equal(timers.size, 1, 'Manual edits are observed even during the self-write window.');
  view._todoEditorEl = {};
  await Array.from(timers.values())[0](); timers.clear();
  assert.equal(view._vaultRefreshPending, true, 'Edits wait while the task editor is open.');
  view._todoEditorEl = null;
  await context.api.cockpitRunSilentRefreshCycle(view, { scopes:[], ignoreRecentActivity:true });
  assert.equal(view._todos[0].text, 'Latest external edit');
  assert.equal(calls.todos, 1);

  content = 'self'; view._todos = [{ text:'old view' }];
  await handlers.get('modify')(file);
  view._todos = [{ text:'self' }];
  await context.api.cockpitRunSilentRefreshCycle(view, { scopes:[], ignoreRecentActivity:true });
  assert.equal(calls.todos, 1, 'A completed local commit suppresses its delayed echo without another file load.');
  view._todos = [{ text:'another window' }];
  await handlers.get('modify')(file);
  await context.api.cockpitRunSilentRefreshCycle(view, { scopes:[], ignoreRecentActivity:true });
  assert.equal(calls.todos, 2, 'Writes made by another view or background service still refresh a stale window.');
  timers.clear();

  view._refreshHabitsRef = async () => { throw new Error('optional module failed'); };
  await context.api.cockpitRunSilentRefreshCycle(view, { scopes:['habits','todos'], ignoreRecentActivity:true });
  assert.equal(calls.todos, 3, 'An optional module failure cannot block task refresh.');
  assert.equal(view._vaultRefreshPending, false);

  view._reloadDashboardState = async () => {
    active++; peak = Math.max(peak, active); count('reload');
    if (calls.reload === 1) await new Promise((resolve) => { release = resolve; });
    active--;
  };
  const first = context.api.cockpitRunSilentRefreshCycle(view, { ignoreRecentActivity:true });
  const second = context.api.cockpitRunSilentRefreshCycle(view, { ignoreRecentActivity:true });
  const third = context.api.cockpitRunSilentRefreshCycle(view, { ignoreRecentActivity:true });
  release(); await Promise.all([first, second, third]);
  assert.equal(peak, 1, 'Refresh triggers never run simultaneous state loads.');
  assert.equal(calls.reload, 2, 'A burst during a refresh coalesces into one follow-up.');

  context.loadTodos = async () => { await new Promise((resolve) => { release = resolve; }); return [{ text:'Old view' }]; };
  const stale = context.api.cockpitRunSilentRefreshCycle(view, { scopes:['todos'], ignoreRecentActivity:true });
  const previous = view._todos; root = {}; release(); await stale;
  assert.equal(view._todos, previous, 'An old refresh cannot overwrite a newly rendered dashboard.');
  context.document.hidden = true;
  await handlers.get('create')({ path:'new.md', extension:'md' });
  assert.equal(view._vaultRefreshPending, true);
  view._cockpitVaultRefreshCancel();
  assert.equal(timers.size, 0);
  assert.equal(view._vaultRefreshScopes.size, 0);
  console.log('Scoped refresh and lifecycle checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
