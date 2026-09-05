const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ctx = vm.createContext({ console, obs:{PluginSettingTab:class {}}, window:{moment:value=>({isValid:()=>value !== 'bad',format:()=>value})} });
for (const file of ['team-sync-core','team-sync','serverchan','morning-brief']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/'+file+'.js'),'utf8'),ctx);
vm.runInContext(`globalThis.api = { CockpitTeamSync, normalizeMorningBriefConfig, normalizeServerChanConfig, buildBriefingTitle, buildBriefingMessage };`,ctx);
(async()=>{
 const api=ctx.api;
 for (const normalize of [api.normalizeMorningBriefConfig,api.normalizeServerChanConfig]) {
  assert.equal(normalize({}).includeTeamTodos,false);
  assert.equal(normalize({includeTeamTodos:true}).includeTeamTodos,true);
  assert.equal(normalize({includeTeamTodos:false}).includeTeamTodos,false);
 }
 const record=(assignee,due='2026-09-05')=>({value:{text:'任务',due,assignee,done:false},origin:{name:'电脑 A'}});
 const service={load:async()=>{},state:{team:{},device:'A',tasks:{a:record('A'),b:record('B'),bad:record('A','bad')}},policy:()=>({syncTodos:true,visibility:'assigned'})};
 const tasks=await api.CockpitTeamSync.prototype.notificationTodos.call(service);
 assert.equal(tasks.length,1,'Only valid, authorized tasks enter notifications');
 assert.match(tasks[0].text,/电脑 A/);
 service.policy=()=>({syncTodos:false,visibility:'all'});
 assert.equal((await api.CockpitTeamSync.prototype.notificationTodos.call(service)).length,0);
 const facts={dueToday:[],overdue:[],teamTodos:tasks,pendingHabitNames:[],habitTotal:0,focusYesterday:0,focusWeek:0};
 assert.match(api.buildBriefingTitle({lang:'zh-CN',username:'你',facts}),/1 项/);
 const body=api.buildBriefingMessage({lang:'zh-CN',username:'你',facts,now:{format:()=>'',day:()=>0,dayOfYear:()=>1}});
 assert.match(body,/团队待办/); assert.match(body,/电脑 A/); assert.doesNotMatch(body,/没有排期/);
 console.log('Team notification scope and brief checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
