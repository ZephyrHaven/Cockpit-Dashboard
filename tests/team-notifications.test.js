const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const fakeMoment = (value) => {
 const raw=String(value || '2026-09-06T12:00:00'); const day=raw.slice(0,10); const time=raw.includes('T') ? raw.slice(11,16) : '00:00';
 return {
  isValid:()=>value !== 'bad',
  format:(pattern)=>pattern==='YYYY-MM-DD'?day:pattern==='HH:mm'?time:pattern==='M月D日'?Number(day.slice(5,7))+'月'+Number(day.slice(8,10))+'日':raw,
  isSame:(other,unit)=>unit==='day' && day===other.format('YYYY-MM-DD'),
  isBefore:(other,unit)=>unit==='day' && day<other.format('YYYY-MM-DD')
 };
};
const ctx = vm.createContext({ console, obs:{PluginSettingTab:class {}}, window:{moment:fakeMoment} });
for (const file of ['team-sync-core','team-sync','serverchan','morning-brief']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/'+file+'.js'),'utf8'),ctx);
vm.runInContext(`globalThis.api = { CockpitTeamSync, normalizeMorningBriefConfig, normalizeServerChanConfig, buildBriefingTitle, buildBriefingMessage, formatTeamTodoNotification, teamTodoDueHasTime };`,ctx);
(async()=>{
 const api=ctx.api;
 assert.equal(api.normalizeMorningBriefConfig({}).includeTeamTodos,true,'Team tasks join the morning brief by default');
 assert.equal(api.normalizeMorningBriefConfig({includeTeamTodos:false}).includeTeamTodos,false);
 assert.equal(api.normalizeServerChanConfig({}).sendTeamTodosSeparately,false);
 assert.equal(api.normalizeServerChanConfig({includeTeamTodos:true}).sendTeamTodosSeparately,false,'The ambiguous legacy flag does not preserve duplicate delivery');
 assert.equal(api.normalizeServerChanConfig({sendTeamTodosSeparately:true}).sendTeamTodosSeparately,true);
 assert.equal(api.teamTodoDueHasTime('2026-09-06'),false);
 assert.equal(api.teamTodoDueHasTime('2026-09-06T00:00:00'),false,'Legacy midnight values retain all-day semantics');
 assert.equal(api.teamTodoDueHasTime('2026-09-06T09:30:00'),true);
 const record=(assignee,due='2026-09-06T00:00:00')=>({value:{text:'任务 #项目',due,assignee,done:false},origin:{name:'电脑 A'}});
 const service={load:async()=>{},state:{team:{},device:'A',tasks:{a:record('A'),b:record('B'),bad:record('A','bad')}},policy:()=>({syncTodos:true,visibility:'assigned'})};
 const tasks=await api.CockpitTeamSync.prototype.notificationTodos.call(service);
 assert.equal(tasks.length,1,'Only valid, authorized tasks enter notifications');
 assert.equal(tasks[0].text,'任务');
 assert.deepEqual(Array.from(tasks[0].tags),['项目']);
 assert.equal(tasks[0].sourceName,'电脑 A');
 assert.equal(tasks[0].dueHasTime,false,'Midnight team tasks render as all-day items');
 service.policy=()=>({syncTodos:false,visibility:'all'});
 assert.equal((await api.CockpitTeamSync.prototype.notificationTodos.call(service)).length,0);
 const now={format:(pattern)=>pattern==='YYYY-MM-DD'?'2026-09-06':'',day:()=>0,dayOfYear:()=>1};
 const second={...tasks[0],text:'第二项任务',dueDate:fakeMoment('2026-09-05')};
 const facts={dueToday:[],overdue:[],teamTodos:[tasks[0],second],pendingHabitNames:[],habitTotal:0,focusYesterday:0,focusWeek:0};
 assert.match(api.buildBriefingTitle({lang:'zh-CN',username:'你',facts}),/2 项/);
 const body=api.buildBriefingMessage({lang:'zh-CN',username:'你',facts,now});
 assert.match(body,/📅 [^\n]+\n\n👥 团队待办 · 2 项\n\n1\. 任务 — 今天\n\n2\. 第二项任务 — 已逾期 · 9月5日/,'Every team task occupies a separate numbered paragraph below a compact date heading');
 assert.doesNotMatch(body,/早安，你/,'The body does not repeat the greeting already present in the notification title');
 assert.doesNotMatch(body,/电脑 A|#项目|00:00|（来源：/,'Push content omits noisy device, tag, and midnight metadata');
 assert.doesNotMatch(body,/没有排期/);
 console.log('Team notification scope and brief checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
