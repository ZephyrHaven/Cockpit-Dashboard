#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
}
global.window = { moment:(value=Date.now()) => new MiniMoment(value) };
const api = require('../src/scheduled-tasks.js');

const now = Date.parse('2026-08-12T10:00:00.000Z');
const tasks = api.normalizeScheduledTasks([
  { id:'daily', name:'Daily review', kind:'obsidian-command', command:'app:open-settings', enabled:true, schedule:{type:'daily',time:'09:30'}, createdAt:'2026-08-01T00:00:00Z' },
  { id:'shell', name:'Unsafe backup', kind:'shell', command:'echo backup', enabled:true, trusted:false, schedule:{type:'interval',intervalMinutes:60}, createdAt:'2026-08-12T08:00:00Z' },
  { id:'weekly', name:'Weekly export', kind:'shell', command:'echo export', enabled:true, trusted:true, schedule:{type:'weekly',time:'11:00',weekdays:[3]}, createdAt:'2026-08-01T00:00:00Z' },
  { id:'toolbar', name:'Run custom button', kind:'toolbar-action', command:'custom:daily-review', enabled:true, schedule:{type:'daily',time:'10:30'}, createdAt:'2026-08-01T00:00:00Z' }
]);
assert.equal(tasks.length, 4);
assert.equal(tasks[1].enabled, false, 'Untrusted Shell tasks can never become active from stored data.');
assert.equal(tasks[3].kind, 'toolbar-action', 'Toolbar actions remain a first-class scheduled task type.');
assert.equal(api.scheduledSlot(tasks[0], now).toISOString(), '2026-08-12T09:30:00.000Z');
assert.equal(api.nextScheduledRun(tasks[0], now).toISOString(), '2026-08-13T09:30:00.000Z');
assert.equal(api.nextScheduledRun(tasks[2], now).toISOString(), '2026-08-12T11:00:00.000Z');
assert.match(api.scheduleLabel(tasks[0], 'en'), /Daily/);

const countdownEditorSchedule = api.scheduledTaskEditorSchedule({
  type:'event', event:'countdown-finished', sourceId:'release', sourceLabel:'版本发布'
});
assert.equal(countdownEditorSchedule.type, 'event', 'Countdown linkage remains an event schedule in the editor.');
assert.equal(countdownEditorSchedule.event, 'countdown-finished');
assert.deepEqual(countdownEditorSchedule.weekdays, [1,2,3,4,5], 'Event schedules receive safe editor-only weekday defaults instead of calling join on undefined.');
assert.equal(countdownEditorSchedule.time, '09:00');

const toolbarActions = api.scheduledToolbarActions({
  _toolbarButtons:() => [{ action:'new', label:'New note' }, { action:'search', label:'Search' }, { action:'more', label:'More' }],
  _customToolbarButtons:[{ id:'daily-review', label:'Daily review', type:'script', hidden:true }]
});
assert.deepEqual(toolbarActions.map((action) => action.id), ['new','custom:daily-review'], 'Automation lists stable built-in/custom IDs and excludes UI-only Toolbar controls.');

const source = fs.readFileSync(path.join(__dirname, '../src/scheduled-tasks.js'), 'utf8');
const framework = fs.readFileSync(path.join(__dirname, '../src/_framework.js'), 'utf8');
const build = fs.readFileSync(path.join(__dirname, '../build.js'), 'utf8');
assert.match(source, /scheduled-tasks\.jsonl/);
assert.match(source, /SCHEDULED_LOG_LIMIT\s*=\s*500/);
assert.match(source, /plugin\.mutateData/, 'Scheduler claims and results use the shared data queue.');
assert.match(source, /async upsert\(task\)/, 'Task edits use an ID-level queued upsert instead of replacing a stale task list.');
assert.match(source, /async toggle\(id\)/, 'Task enablement changes update the latest queued record.');
assert.match(source, /async remove\(id\)/, 'Task deletion updates the latest queued record.');
assert.match(source, /async clearLogs\(\)/, 'The audit service exposes an explicit log clearing operation.');
assert.match(source, /Clear all scheduled task audit logs[\s\S]*clearLogs\(\)/, 'Clearing audit logs requires confirmation before deleting records.');
assert.match(source, /makeCockpitDialogDraggable\(panel, head/, 'Scheduler secondary pages are draggable by their headers.');
assert.match(source, /runToolbarAction[\s\S]*loadData[\s\S]*normalizeCustomToolbarButtons/, 'Scheduled Toolbar actions reload the latest custom button definition before every run.');
assert.match(source, /plugin\._open[\s\S]*_toolbarView/, 'A due Toolbar action can safely restore the Cockpit view before execution.');
assert.match(source, /Toolbar action no longer exists/, 'Deleted Toolbar actions fail explicitly instead of reporting a false success.');
assert.match(source, /toolbar-action[\s\S]*toolbarPicker/, 'The scheduled task editor exposes a Toolbar action picker.');
assert.doesNotMatch(source, /_data\/.+\.md/, 'Scheduled tasks do not add Markdown files under _data.');
assert.match(framework, /id:'scheduledTasks'[\s\S]*collapsible:true/, 'The scheduler participates in layout, visibility, scenes, and collapse state.');
assert.match(build, /'scheduled-tasks\.js'/);

const draggableSources = ['_framework.js','scenes.js','tip-store.js','rss.js','storage.js','toolbar-config.js','toolbar-custom.js']
  .map((file) => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8')).join('\n');
assert.match(draggableSources, /makeCockpitModalDraggable/, 'Native secondary modals use the shared drag behavior.');
assert.ok((draggableSources.match(/makeCockpitDialogDraggable/g) || []).length >= 7, 'Custom secondary pages consistently use the shared drag behavior.');

const storage = fs.readFileSync(path.join(__dirname, '../src/storage.js'), 'utf8');
assert.doesNotMatch(storage, /vault\.create\(['"]_data\/toolbar\.md/, 'Fresh installs never create toolbar.md.');
console.log('Scheduled task checks passed');
