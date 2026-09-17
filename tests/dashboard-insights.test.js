const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({console,TextEncoder,Date,URL,Blob,window:{moment:()=>({format:()=> '2026-09-17'})},obs:{Modal:class{}},lanSyncObject:value=>value&&typeof value==='object',lanSyncDevice:()=>true});
for(const name of ['team-sync-core','dashboard-insights'])vm.runInContext(fs.readFileSync('src/'+name+'.js','utf8'),context);
vm.runInContext('this.api={cockpitTeamVisible,cockpitTeamStats,cockpitTeamCalendar,cockpitRunRecords,cockpitSyncDiagnostics};',context);
const records=[{id:'one',value:{text:'Task, a; b #team',done:false,due:'2026-09-16',assignee:'me'},origin:{name:'Alice'},updatedAt:Date.now()}, {id:'two',value:{text:'Secret',done:false,due:'2026-09-19T09:30',assignee:'other'},origin:{name:'Bob'},updatedAt:Date.now()}, {id:'three',value:{text:'Done',done:true,due:'2026-09-16',assignee:'me'},origin:{name:'Alice'},updatedAt:Date.now()}];
const service={state:{team:{},device:'me',tasks:Object.fromEntries(records.map(record=>[record.id,record]))},policy:()=>({syncTodos:true,visibility:'assigned'})};
const visible=context.api.cockpitTeamVisible(service);assert.equal(visible.length,2);const stats=context.api.cockpitTeamStats(visible);assert.equal(stats.done,1);assert.equal(stats.overdue,1);assert.equal(stats.owners[0].open,1);
const ics=context.api.cockpitTeamCalendar(visible);assert.match(ics,/DTSTART;VALUE=DATE:20260916/);assert.match(ics,/SUMMARY:Task\\, a\\; b/);assert.doesNotMatch(ics,/Secret|SUMMARY:Done/);
service.policy=()=>({syncTodos:false,visibility:'all'});assert.equal(context.api.cockpitTeamVisible(service).length,0,'Revoked visibility is rechecked at each read.');
(async()=>{
  const plugin={loadData:async()=>({workflows:[{id:'w',name:'Workflow',runs:[{at:'2026-09-17T09:00:00Z',status:'failed',steps:[{error:'token=secret https://example.test/key'}]}]}],morningBrief:{sent:{'2026-09-17':{bark:{at:'2026-09-17T10:00:00Z',ok:true}}}},serverChan:{sentReminders:{slot:{meow:{at:'2026-09-17T11:00:00Z',ok:false,error:'timeout'}}}},appleCalendarSync:{lastSyncResult:{at:'2026-09-17T12:00:00Z',status:'failed',error:'denied'}}}),scheduledTasks:{readLogs:()=>[{timestamp:'2026-09-17T08:00:00Z',name:'Task',status:'success',taskId:'s'}]}};
  const logs=await context.api.cockpitRunRecords(plugin);assert.equal(logs.length,5);assert.equal(logs[0].type,'calendar');assert.doesNotMatch(JSON.stringify(logs),/token=secret|example\.test/);
  console.log('Visible team stats, calendar and combined run records passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
