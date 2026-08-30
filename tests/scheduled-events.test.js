#!/usr/bin/env node

const assert = require('node:assert/strict');

class MiniMoment {
  constructor(value) { this.date = value instanceof MiniMoment ? new Date(value.valueOf()) : new Date(value); }
  clone(){ return new MiniMoment(this); } valueOf(){ return this.date.valueOf(); } toISOString(){ return this.date.toISOString(); }
  isAfter(other){ return this.valueOf() > new MiniMoment(other).valueOf(); }
  diff(other, unit){ const ms=this.valueOf()-new MiniMoment(other).valueOf(); return unit==='minutes'?Math.floor(ms/60000):ms; }
  add(amount,unit){ const ms=unit==='day'?86400000:60000;this.date=new Date(this.valueOf()+amount*ms);return this; }
  subtract(amount,unit){ return this.add(-amount,unit); }
  startOf(unit){ if(unit==='day')this.date.setUTCHours(0,0,0,0);return this; }
  hour(value){ if(value===undefined)return this.date.getUTCHours();this.date.setUTCHours(value);return this; }
  minute(value){ if(value===undefined)return this.date.getUTCMinutes();this.date.setUTCMinutes(value);return this; }
  day(){ return this.date.getUTCDay(); }
  format(pattern){
    const iso = this.date.toISOString();
    if (pattern === 'YYYY-MM-DD') return iso.slice(0, 10);
    if (pattern === 'HH:mm') return iso.slice(11, 16);
    if (pattern === 'YYYY-MM-DD HH:mm') return iso.slice(0, 16).replace('T', ' ');
    return iso;
  }
}
global.window = { moment:(value=Date.now()) => new MiniMoment(value) };

const api = require('../src/scheduled-tasks.js');
const { cockpitOn, cockpitEmit, cockpitOff } = require('../src/cockpit-events.js');

(async () => {
// ── 数据模型：事件触发与轻动作（完全向后兼容）────────────────────────────────
const tasks = api.normalizeScheduledTasks([
  { id:'legacy', name:'Legacy daily', kind:'obsidian-command', command:'app:open', enabled:true, schedule:{type:'daily', time:'09:00'}, createdAt:'2026-08-01T00:00:00Z' },
  { id:'on-save', name:'整理 Projects', kind:'append-daily', command:'- 整理 {date} 新笔记', enabled:true,
    schedule:{type:'event', event:'file-saved', folder:'Projects'}, createdAt:'2026-08-12T00:00:00Z' },
  { id:'on-todo', name:'完成待办后追加', kind:'append-daily', command:'- 完成：{datetime}', enabled:true,
    schedule:{type:'event', event:'todo-completed'}, createdAt:'2026-08-12T00:00:00Z' },
  { id:'on-pomo', name:'番茄钟推送', kind:'push', command:'专注 {time} 结束，休息一下', enabled:true,
    schedule:{type:'event', event:'pomodoro-finished'}, createdAt:'2026-08-12T00:00:00Z' },
  { id:'on-report', name:'周报保存后复盘', kind:'append-daily', command:'- 周报已保存', enabled:true,
    schedule:{type:'event', event:'weekly-report-saved'}, createdAt:'2026-08-12T00:00:00Z' },
  { id:'on-countdown', name:'发布倒计时结束', kind:'workflow', command:'release-flow', enabled:true,
    schedule:{type:'event', event:'countdown-finished', sourceId:'release', sourceLabel:'版本发布'}, createdAt:'2026-08-12T00:00:00Z' },
  { id:'on-create', name:'每天建一条', kind:'create-todo', command:'回顾 {date}', enabled:true,
    schedule:{type:'daily', time:'20:00'}, createdAt:'2026-08-12T00:00:00Z' }
]);
assert.equal(tasks.length, 7);
assert.equal(tasks[0].schedule.event, 'file-saved', 'Legacy tasks gain event defaults without changing their schedule type.');
assert.equal(tasks[0].schedule.type, 'daily');
assert.equal(tasks[1].schedule.type, 'event');
assert.equal(tasks[1].schedule.folder, 'Projects');
assert.equal(tasks[3].kind, 'push');
assert.equal(tasks[5].schedule.sourceId, 'release', 'Countdown event rules preserve their source filter.');
assert.equal(tasks[5].schedule.sourceLabel, '版本发布');

// 事件任务永不进入时间轮询。
const now = Date.parse('2026-08-12T10:00:00.000Z');
assert.equal(api.scheduledSlot(tasks[1], now), null, 'Event tasks are never claimed by the polling tick.');
assert.equal(api.nextScheduledRun(tasks[1], now), null);
assert.equal(api.scheduledSlot(tasks[0], now).toISOString(), '2026-08-12T09:00:00.000Z', 'Time schedules keep working unchanged.');
assert.match(api.scheduleLabel(tasks[1], 'zh'), /触发于笔记保存/);
assert.match(api.scheduleLabel(tasks[1], 'en'), /Note saved/);
assert.match(api.scheduleLabel(tasks[1], 'zh'), /Projects/, 'Folder filters surface in the schedule label.');
assert.match(api.scheduleLabel(tasks[2], 'zh'), /待办完成/);
assert.match(api.scheduleLabel(tasks[4], 'zh'), /周报已保存/);
assert.match(api.scheduleLabel(tasks[5], 'zh'), /倒计时结束/);
assert.match(api.scheduleLabel(tasks[5], 'zh'), /版本发布/, 'Countdown source filters are visible in rule summaries.');

// ── 路径匹配 ────────────────────────────────────────────────────────────────
assert.equal(api.eventTaskMatchesPath(tasks[1], ['Projects/Alpha.md']), true);
assert.equal(api.eventTaskMatchesPath(tasks[1], ['Projects/Sub/Beta.md']), true, 'Folder filters match by prefix.');
assert.equal(api.eventTaskMatchesPath(tasks[1], ['Notes/Idea.md']), false);
assert.equal(api.eventTaskMatchesPath(tasks[1], []), false);
const anyFolder = api.normalizeScheduledTasks([{ id:'x', name:'x', kind:'append-daily', command:'hi', schedule:{type:'event', event:'file-saved'} }])[0];
assert.equal(api.eventTaskMatchesPath(anyFolder, ['Anywhere/Note.md']), true, 'An empty folder filter matches any saved note.');
assert.equal(api.eventTaskMatchesPayload(tasks[5], 'countdown-finished', {countdownId:'release'}), true);
assert.equal(api.eventTaskMatchesPayload(tasks[5], 'countdown-finished', {countdownId:'other'}), false, 'A countdown rule only accepts its selected countdown.');
assert.equal(api.eventTaskMatchesPayload(tasks[5], 'todo-completed', {}), true, 'Existing event types remain payload-compatible.');
const anyCountdown = api.normalizeScheduledTasks([{ id:'any-countdown', name:'任意倒计时', kind:'push', command:'done', schedule:{type:'event', event:'countdown-finished'} }])[0];
assert.equal(api.eventTaskMatchesPayload(anyCountdown, 'countdown-finished', {countdownId:'anything'}), true, 'An empty countdown source filter matches any countdown.');

// ── 模板占位符 ──────────────────────────────────────────────────────────────
global.window.moment = () => new MiniMoment(Date.parse('2026-08-12T09:30:00.000Z'));
assert.equal(api.scheduledTemplateText('回顾 {date} 于 {time} ({datetime})'), '回顾 2026-08-12 于 09:30 (2026-08-12 09:30)');

// ── 事件总线 ────────────────────────────────────────────────────────────────
{
  let seen = 0;
  const off = cockpitOn('demo', () => { seen += 1; });
  cockpitEmit('demo', {});
  cockpitEmit('demo', {});
  assert.equal(seen, 2);
  off();
  cockpitEmit('demo', {});
  assert.equal(seen, 2, 'Unsubscribed handlers stop receiving events.');
  let survived = false;
  cockpitOn('demo', () => { throw new Error('boom'); });
  cockpitOn('demo', () => { survived = true; });
  cockpitEmit('demo', {});
  assert.equal(survived, true, 'A failing handler never blocks other listeners.');
  cockpitOff('demo');
}

// ── 事件分发：匹配 → 执行 → 冷却 ────────────────────────────────────────────
{
  const files = new Map();
  const vault = {
    getAbstractFileByPath:(path) => files.has(path) ? { path, extension:'md' } : (path === '_daily' ? { path, type:'folder' } : null),
    createFolder:async () => {},
    create:async (path, content) => { files.set(path, content); },
    read:async (file) => files.get(file.path) || '',
    modify:async (file, content) => { files.set(file.path, content); }
  };
  let saved = null;
  const workflowRuns = [];
  const raw = { scheduledTasks: api.normalizeScheduledTasks([
    { id:'on-todo', name:'完成待办后追加', kind:'append-daily', command:'- 完成：{datetime}', enabled:true,
      schedule:{type:'event', event:'todo-completed'}, createdAt:'2026-08-12T00:00:00Z' },
    { id:'unrelated', name:'笔记任务', kind:'append-daily', command:'x', enabled:true,
      schedule:{type:'event', event:'file-saved', folder:'Projects'}, createdAt:'2026-08-12T00:00:00Z' },
    { id:'on-countdown-flow', name:'发布后流程', kind:'workflow', command:'release-flow', enabled:true,
      schedule:{type:'event', event:'countdown-finished', sourceId:'release', sourceLabel:'版本发布'}, createdAt:'2026-08-12T00:00:00Z' }
  ]) };
  const plugin = {
    app:{ isMobile:true, vault },
    workflows:{ run:async (id, options) => { workflowRuns.push({id, options});return {ok:true,status:'success',record:{durationMs:1}};} },
    loadData:async () => raw,
    mutateData:async (mutator) => { const data = JSON.parse(JSON.stringify(raw)); mutator(data); raw.scheduledTasks = data.scheduledTasks; saved = raw.scheduledTasks; },
    registerEvent:() => {}, registerInterval:() => {}
  };
  const service = new api.ScheduledTaskService(plugin);
  service.started = true; // 不 start()：避免真实定时器，只测事件分发。
  const waitFor = async (predicate) => {
    for (let index = 0; index < 50 && !predicate(); index++) await new Promise((resolve) => setTimeout(resolve, 10));
  };
  // 待办完成事件 → 匹配任务把模板追加进今日日记；不匹配的文件任务保持未运行。
  service.dispatchEventTrigger('todo-completed', {});
  await waitFor(() => files.has('_daily/2026-08-12.md'));
  assert.match(files.get('_daily/2026-08-12.md'), /- 完成：2026-08-12 09:30/, 'The todo-completed event runs the matching template action.');
  assert.ok(saved, 'The run is recorded through the shared data queue.');
  assert.ok(raw.scheduledTasks.find((task) => task.id === 'on-todo').lastRunAt, 'The completed run stores its timestamp.');
  assert.equal(raw.scheduledTasks.find((task) => task.id === 'unrelated').lastRunAt || '', '', 'Unmatched event tasks stay idle.');

  // 冷却期：刚刚运行过的任务在窗口内不重复触发。
  files.delete('_daily/2026-08-12.md');
  await service.dispatchEventTrigger('todo-completed', {});
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(files.has('_daily/2026-08-12.md'), false, 'The cooldown window suppresses immediate re-runs.');

  // 文件保存事件：文件夹过滤生效。
  await service.dispatchEventTrigger('file-saved', { paths:['Notes/Idea.md'] });
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(raw.scheduledTasks.find((task) => task.id === 'unrelated').lastRunAt || '', '', 'A file outside the filtered folder never triggers the task.');
  await service.dispatchEventTrigger('file-saved', { paths:['Projects/Alpha.md'] });
  await waitFor(() => raw.scheduledTasks.find((task) => task.id === 'unrelated').lastRunAt);
  assert.ok(raw.scheduledTasks.find((task) => task.id === 'unrelated').lastRunAt, 'A saved note inside the folder triggers the task.');

  await service.dispatchEventTrigger('countdown-finished', {countdownId:'other',eventKey:'finished'});
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(workflowRuns.length, 0, 'A different countdown never starts a source-filtered workflow.');
  await service.dispatchEventTrigger('countdown-finished', {countdownId:'release',eventKey:'finished'});
  await waitFor(() => workflowRuns.length === 1);
  assert.deepEqual(workflowRuns[0], {id:'release-flow',options:{trigger:'event'}}, 'The selected countdown starts the linked workflow through the shared action engine.');
}

console.log('Scheduled event trigger checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
