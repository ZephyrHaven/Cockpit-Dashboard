#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

class MiniMoment {
  constructor(value) { this.date = value instanceof MiniMoment ? new Date(value.valueOf()) : new Date(value); }
  clone(){ return new MiniMoment(this); }
  valueOf(){ return this.date.valueOf(); }
  toISOString(){ return this.date.toISOString(); }
  diff(other, unit){ const ms=this.valueOf()-new MiniMoment(other).valueOf(); return unit==='minutes'?Math.floor(ms/60000):ms; }
  add(amount, unit){ const ms=unit==='day'?86400000:60000;this.date=new Date(this.valueOf()+amount*ms);return this; }
  startOf(unit){ if(unit==='day')this.date.setUTCHours(0,0,0,0);return this; }
  hour(value){ if(value===undefined)return this.date.getUTCHours();this.date.setUTCHours(value);return this; }
  minute(value){ if(value===undefined)return this.date.getUTCMinutes();this.date.setUTCMinutes(value);return this; }
  day(){ return this.date.getUTCDay(); }
  format(pattern){ const iso=this.date.toISOString();if(pattern==='YYYY-MM-DD')return iso.slice(0,10);if(pattern==='HH:mm')return iso.slice(11,16);return iso; }
}

global.window = { moment:(value=Date.now()) => new MiniMoment(value) };
const api = require('../src/scheduled-tasks.js');
const dayFlowApi = require('../src/calendar-day-flow.js');

const rssSummary = dayFlowApi.summarizeCalendarRss([
  {id:'a',feedId:'ops',title:'服务器巡检',publishedAt:Date.parse('2026-08-12T08:00:00Z')},
  {id:'b',feedId:'ops',title:'备份完成',publishedAt:Date.parse('2026-08-12T09:00:00Z'),readAt:'2026-08-12T09:10:00Z'},
  {id:'c',feedId:'news',title:'行业快讯',publishedAt:Date.parse('2026-08-12T10:00:00Z')}
], (feedId)=>({name:feedId==='ops'?'运维':'资讯'}));
assert.equal(rssSummary.count, 3, 'Calendar RSS is aggregated instead of rendering an article row per item.');
assert.equal(rssSummary.unreadCount, 2);
assert.deepEqual(rssSummary.sources, ['运维','资讯']);

const countdownItems = dayFlowApi.calendarCountdownItemsForDate([
  {id:'today-deadline',name:'今日截止',enabled:true,startAt:'2026-08-10T00:00:00Z',targetAt:'2026-08-12T15:30:00Z'},
  {id:'tomorrow-deadline',name:'明日截止',enabled:true,startAt:'2026-08-10T00:00:00Z',targetAt:'2026-08-13T09:00:00Z'}
], '2026-08-12');
assert.deepEqual(countdownItems.map((item)=>item.id), ['today-deadline'], 'The daily overview includes countdowns on their completion date only.');
assert.equal(countdownItems[0].time, '15:30', 'Countdown rows expose the completion time.');

const tasks = api.normalizeScheduledTasks([
  {id:'daily',name:'日报归档',kind:'workflow',command:'daily-flow',enabled:true,schedule:{type:'daily',time:'09:30'},createdAt:'2026-08-01T00:00:00Z',lastRunAt:'2026-08-12T09:31:00Z',lastStatus:'success'},
  {id:'weekly',name:'周中备份',kind:'shell',command:'backup',trusted:true,enabled:true,schedule:{type:'weekly',time:'11:00',weekdays:[3]},createdAt:'2026-08-01T00:00:00Z'},
  {id:'interval',name:'同步监控',kind:'toolbar-action',command:'sync',enabled:true,schedule:{type:'interval',intervalMinutes:60},createdAt:'2026-08-12T08:00:00Z'},
  {id:'event',name:'待办完成联动',kind:'push',command:'done',enabled:true,schedule:{type:'event',event:'todo-completed'},createdAt:'2026-08-01T00:00:00Z'},
  {id:'paused',name:'暂停任务',kind:'push',command:'skip',enabled:false,schedule:{type:'daily',time:'12:00'},createdAt:'2026-08-01T00:00:00Z'}
]);

const today = api.scheduledTaskDayPlan(tasks, '2026-08-12', Date.parse('2026-08-12T10:00:00Z'));
assert.deepEqual(today.map((item)=>item.id), ['daily','interval','weekly','event'], 'The day plan includes every enabled timed and event automation once, in useful order.');
assert.equal(today[0].status, 'success', 'Runs completed today surface their audit status.');
assert.equal(today[1].time, '10:00', 'Interval tasks surface the next occurrence inside the selected day.');
assert.equal(today[2].time, '11:00');
assert.equal(today[3].status, 'listening');
assert.equal(today[3].time, '', 'Event automations are shown as listeners instead of inventing a time.');

const tomorrow = api.scheduledTaskDayPlan(tasks, '2026-08-13', Date.parse('2026-08-12T10:00:00Z'));
assert.equal(tomorrow.some((item)=>item.id==='event'), false, 'Unknown-time event listeners only appear in today’s operational view.');
assert.equal(tomorrow.some((item)=>item.id==='weekly'), false, 'Weekly tasks only appear on matching weekdays.');

const root = path.resolve(__dirname, '..');
const calendar = fs.readFileSync(path.join(root, 'src/calendar.js'), 'utf8');
const dayFlow = fs.readFileSync(path.join(root, 'src/calendar-day-flow.js'), 'utf8');
const framework = fs.readFileSync(path.join(root, 'src/_framework.js'), 'utf8');
const build = fs.readFileSync(path.join(root, 'build.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
assert.match(framework, /id:'agenda'[\s\S]*buildAgendaModule/, 'The independent agenda component remains available and unchanged.');
assert.match(calendar, /loadAutomationItems/, 'The calendar day flow loads automation plans for the selected date.');
assert.match(dayFlow, /summarizeCalendarRss/, 'RSS entries are condensed into one daily summary row.');
assert.doesNotMatch(dayFlow, /\.\.\.articles\.map\(\(rssItem\)/, 'The calendar no longer expands every RSS article into the timeline.');
assert.match(dayFlow, /cal-flow-filter[\s\S]*automation[\s\S]*rss/, 'The combined day flow can be filtered by source.');
assert.match(dayFlow, /countdownItems[\s\S]*kind:'countdown'/, 'Countdown completions participate in the shared daily timeline.');
assert.match(dayFlow, /if \(todo && todo === nextTimed\)/, 'Only the actual next todo receives the NOW badge.');
assert.match(dayFlow, /cal-timeline-summary/, 'Timeline titles and metadata share a bounded summary region before the action rail.');
assert.match(styles, /\.cockpit-dashboard-cal-timeline-content\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/, 'Timeline actions stay in a dedicated trailing column instead of wrapping under metadata.');
assert.match(styles, /\.cockpit-dashboard-cal-timeline-summary\s*\{[^}]*min-width:0/, 'Timeline summary content can shrink without displacing its actions.');
assert.match(styles, /cal-timeline-summary > button\.cockpit-dashboard-cal-timeline-title\s*\{[^}]*display:block[^}]*justify-content:flex-start/, 'Timeline titles override the host button centering and align from one common left edge.');
assert.match(calendar, /onAutomationOpen[\s\S]*onAutomationRun/, 'Automation rows expose inspect and run-now actions.');
assert.match(build, /'calendar-day-flow\.js'[\s\S]*'calendar\.js'/, 'The day-flow renderer is bundled before the calendar module.');

console.log('Calendar day flow checks passed');
