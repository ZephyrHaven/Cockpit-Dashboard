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
const { calendarSplitOwner, calendarBuildEventDayMap } = require('../src/calendar.js');

const initialCalendarHost = { id:'dashboard-root' };
const mountedCalendarModule = { id:'calendar-module' };
const splitCalendarNode = { parentElement:initialCalendarHost };
const splitHandleNode = { parentElement:initialCalendarHost };
assert.equal(calendarSplitOwner(splitCalendarNode, splitHandleNode), initialCalendarHost);
splitCalendarNode.parentElement = mountedCalendarModule;
splitHandleNode.parentElement = mountedCalendarModule;
assert.equal(calendarSplitOwner(splitCalendarNode, splitHandleNode), mountedCalendarModule, 'The splitter resolves its current module after the calendar is reparented by the layout system.');

const repeatedUid = 'daily-multiday-series';
const overlappingOccurrences = Array.from({ length:7 }, (_, index) => ({
  id:repeatedUid + '@' + index,
  uid:repeatedUid,
  calendar:'工作',
  title:'重复日程',
  start:Date.parse(`2026-10-${18 + index}T00:00:00Z`),
  end:Date.parse(`2026-10-${25 + index}T00:00:00Z`),
  allDay:true
}));
const separateEvent = { id:'separate', uid:'separate', calendar:'工作', title:'另一项', start:Date.parse('2026-10-24T08:00:00Z'), end:Date.parse('2026-10-24T09:00:00Z') };
const eventDayMap = calendarBuildEventDayMap([...overlappingOccurrences, separateEvent], window.moment);
assert.equal(eventDayMap['2026-10-24'].length, 2, 'Overlapping occurrences from one recurring UID appear only once on a given day.');
assert.equal(eventDayMap['2026-10-24'][0].start, Date.parse('2026-10-24T00:00:00Z'), 'The day keeps the occurrence that starts on that date.');
assert.equal(eventDayMap['2026-10-23'].length, 1, 'A recurring multi-day series still remains visible on every covered day.');

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
assert.doesNotMatch(dayFlow, /format\(todo\.teamTodo \? 'HH:mm:ss'/, 'Team tasks use the same minute-level time style as personal tasks.');
assert.match(dayFlow, /cal-timeline-tag/, 'Task tags render as separate calendar pills instead of leaking into the title.');
assert.match(framework, /teamTodoTextParts\(task\.value\.text\)[\s\S]*tags:parts\.tags/, 'Team task titles and tags are split before entering the calendar.');
assert.match(framework, /dueHasTime:teamTodoDueHasTime/, 'Legacy midnight team tasks enter the calendar as all-day items.');
assert.match(styles, /\.cockpit-dashboard-cal-timeline-content\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/, 'Timeline actions stay in a dedicated trailing column instead of wrapping under metadata.');
assert.match(styles, /\.cockpit-dashboard-cal-timeline-summary\s*\{[^}]*min-width:0/, 'Timeline summary content can shrink without displacing its actions.');
assert.match(styles, /cal-timeline-summary > button\.cockpit-dashboard-cal-timeline-title\s*\{[^}]*display:block[^}]*justify-content:flex-start/, 'Timeline titles override the host button centering and align from one common left edge.');
assert.match(styles, /cal-timeline-tag\.cockpit-dashboard-todo-tag-pill/, 'Calendar tags preserve the shared personal-task pill vocabulary.');
assert.match(styles, /--ck-cal-split-week-height:clamp\(640px, 68vh, 760px\)/, 'Split week view and daily overview share a bounded height.');
assert.match(styles, /cal-surface\.is-week\)[^{]*\{[^}]*--ck-cal-split-left:47\.5%/s, 'Split week view gives the actionable daily overview a slight visual priority.');
assert.match(styles, /cal-timeline:has\(> \.cockpit-dashboard-cal-timeline-row:nth-child\(4\)\)[^{]*> \.cockpit-dashboard-cal-timeline-row\s*\{[^}]*flex:1 1 0[^}]*min-height:88px/s, 'Busy split-week timelines distribute rows across the available body height.');
assert.match(styles, /cal-surface\.is-week \.cockpit-dashboard-cal-week\s*\{[^}]*grid-template-columns:repeat\(6,[^}]*grid-template-rows:repeat\(3,/s, 'Split week view keeps the requested 3 + 2 + 2 three-row rhythm.');
assert.match(styles, /cal-week-day:nth-child\(4\)[\s\S]*cal-week-day:nth-child\(7\)[^{]*\{[^}]*grid-column:span 3/s, 'The final four days form two balanced two-card rows.');
assert.match(calendar, /cal-split-resize[\s\S]*setPointerCapture[\s\S]*pointermove[\s\S]*ArrowLeft[\s\S]*dblclick/, 'Split calendar exposes a pointer, keyboard, and reset-capable resize handle.');
assert.match(calendar, /gridTemplateColumns[\s\S]*requestAnimationFrame\(flushDragFrame\)/, 'Calendar resizing updates the grid once per animation frame.');
assert.match(calendar, /const activeModule = calendarSplitOwner\(calRoot, splitHandle\);[\s\S]*drag = \{[^}]*module:activeModule/, 'A drag targets the splitter current module instead of the parent captured before layout mounting.');
assert.match(calendar, /apply\(splitRatio, \{ persist:true, bounds, target:activeModule \}\)/, 'Calendar resizing persists its final ratio after interaction.');
assert.match(calendar, /onSplitRatioChange\?\.\(splitRatio\)/, 'Calendar resizing reports its settled ratio to plugin persistence.');
assert.match(framework, /id:'calendar'[\s\S]{0,360}cal-split-resize/, 'The split handle belongs to the calendar module during first-pass layout mounting.');
const splitPointerMove = calendar.match(/splitHandle\.addEventListener\('pointermove',[\s\S]*?\n\s*\}\);/)?.[0] || '';
assert.doesNotMatch(splitPointerMove, /getBoundingClientRect/, 'Pointer movement reuses drag-start geometry instead of forcing a synchronous layout read on every event.');
assert.match(framework, /calendarSplitRatio[\s\S]*_setCalendarSplitRatio[\s\S]*onSplitRatioChange/, 'The calendar split ratio is restored from and saved to plugin data.');
assert.match(styles, /grid-template-columns:minmax\(0, var\(--ck-cal-split-left\)\) var\(--ck-cal-split-handle-width\) minmax\(0, 1fr\)/, 'Split calendar reserves a dedicated draggable middle column.');
assert.match(styles, /cal-split-resize\s*\{[^}]*width:20px[^}]*height:72px[^}]*cursor:ew-resize[^}]*opacity:\.35/s, 'The calendar splitter mirrors the overall dashboard resize handle dimensions and resting state.');
assert.match(styles, /@container \(max-width: 440px\)[\s\S]*grid-template-columns:repeat\(2,[\s\S]*grid-template-rows:repeat\(4,/, 'A narrowed week pane reflows its seven cards instead of clipping them.');
assert.match(calendar, /onAutomationOpen[\s\S]*onAutomationRun/, 'Automation rows expose inspect and run-now actions.');
assert.match(build, /'calendar-day-flow\.js'[\s\S]*'calendar\.js'/, 'The day-flow renderer is bundled before the calendar module.');

// 双击快速新建的时间解析与日历内交互接线。
const { parseQuickTodoInput } = require('../src/quick-parse.js');
const qNow = new Date(2026, 9, 14, 16, 0); // 周三 16:00
const q = (text, options) => parseQuickTodoInput(text, qNow, options);
const qDay = (parsed) => parsed.date && `${parsed.date.m + 1}/${parsed.date.d}`;
assert.deepEqual([q('14:30 开会').text, q('14:30 开会').hour, q('14:30 开会').minute], ['开会', 14, 30]);
assert.equal(qDay(q('14:30 开会')), '10/15', 'A time already past today rolls to tomorrow.');
assert.equal(qDay(q('14:30 开会', { defaultDate:new Date(2026, 9, 20) })), '10/20', 'Calendar quick add keeps the double-clicked day.');
assert.equal(q('下午3点 复盘').hour, 15);
assert.deepEqual([q('9点半 晨会').hour, q('9点半 晨会').minute], [9, 30]);
assert.equal(q('今晚8点 看电影').hour, 20, 'Tonight implies an evening hour.');
assert.equal(q('两点半 午休结束').hour, 14, 'Bare 1–5 o’clock reads as afternoon.');
assert.equal(qDay(q('周五 交周报')), '10/16');
assert.equal(qDay(q('下周一 晨会')), '10/19');
assert.equal(qDay(q('next mon kickoff')), '10/19');
assert.equal(qDay(q('3天后 复查')), '10/17');
assert.equal(qDay(q('10月20日 体检')), '10/20');
assert.equal(q('2026-02-31 无效日期').date, null, 'Impossible explicit dates are not silently normalized.');
assert.equal(q('2月31日 无效日期').date, null, 'Impossible month/day dates remain ordinary text.');
assert.equal(qDay(q('周末 大扫除')), '10/17');
assert.deepEqual([q('明天 回电话 !高 #工作').priority, q('明天 回电话 !高 #工作').tags], ['high', ['工作']]);
assert.equal(q('跑快一点').hasTime, false, 'Colloquial “一点” is not a time.');
assert.equal(q('买2个苹果').date, null, 'Plain text stays undated.');
assert.equal(q('25:00 无效').hasTime, false, 'Out-of-range times are kept as text.');
const calendarSource = fs.readFileSync(path.join(__dirname, '../src/calendar.js'), 'utf8');
const frameworkSource = fs.readFileSync(path.join(__dirname, '../src/_framework.js'), 'utf8');
assert.match(calendarSource, /application\/x-cockpit-calendar[\s\S]*keepTime/, 'Dragging inside the calendar keeps the original time.');
assert.match(frameworkSource, /options\.keepTime && target\.dueHasTime/, 'Scheduling preserves the time only for in-calendar drags.');
assert.match(calendarSource, /addEventListener\('dblclick'[\s\S]*openQuickCreate/, 'Double-clicking a day opens inline quick create.');
assert.match(frameworkSource, /loadCalendarEvents:[\s\S]*readEvents/, 'The calendar loads read-only system events through the Apple calendar service.');

// 会议笔记：文件名安全、frontmatter 转义、已存在时只打开不覆盖。
const meetingSource = fs.readFileSync(path.join(__dirname, '../src/meeting-notes.js'), 'utf8');
assert.match(meetingSource, /if \(!file\) \{[\s\S]*vault\.create/, 'Meeting notes are created only when missing.');
assert.match(meetingSource, /content\.includes\(link\) \? content/, 'Daily-note links are appended once.');
assert.doesNotMatch(meetingSource, /vault\.(?:delete|trash|modify)\(/, 'Meeting notes never delete or overwrite vault files.');
const quickCaptureSource = fs.readFileSync(path.join(__dirname, '../src/quick-capture.js'), 'utf8');
assert.match(quickCaptureSource, /mutateTodos\(plugin\.app\.vault/, 'Quick capture writes through the shared todo mutation queue.');
const agentToolsSource = fs.readFileSync(path.join(__dirname, '../src/ai-tools.js'), 'utf8');
assert.match(agentToolsSource, /cockpitQueueRefreshScopes\(view, \['todos'\]\)/, 'Agent todo changes enter the scoped silent-refresh pipeline.');
assert.doesNotMatch(agentToolsSource, /refreshCockpitAfterAgentMutation[\s\S]*?_renderDashboard\(true\)/, 'Agent todo changes never rebuild the entire dashboard.');
assert.match(fs.readFileSync(path.join(__dirname, '../src/commands.js'), 'utf8'), /id:'quick-capture'(?![\s\S]{0,200}hotkeys)/, 'Quick capture is a command without a default hotkey.');

console.log('Calendar day flow checks passed');
