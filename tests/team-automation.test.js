const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const events=[],context=vm.createContext({require,console:{warn(){}},Buffer,cockpitEmit:(name,payload)=>events.push({name,payload})});
for(const name of ['lan-sync-core','team-sync-core','team-sync'])vm.runInContext(fs.readFileSync('src/'+name+'.js','utf8'),context);
vm.runInContext('this.Service=CockpitTeamSync;this.policy=teamSyncDefaultPolicy;',context);
const A='a'.repeat(32),B='b'.repeat(32),T='c'.repeat(32),I='d'.repeat(32);
function make(device=A){
  const files=new Map();let fail='';const plugin={app:{vault:{adapter:{write:async(path,text)=>{if(path.endsWith(fail)&&fail)throw Error('disk');files.set(path,text);}}}},lanSync:{store:{load:async()=>{},state:{device},path:'plugin/lan-sync-machine.json'}}};
  const service=new context.Service(plugin);service.path='plugin/team-sync-machine.json';service.state={version:1,generation:0,device,name:device===A?'Host':'Member',enabled:false,port:0,team:{id:T,host:A,name:'Team'},peers:[],tasks:{},revision:0,pending:[],drafts:[],conflicts:[],nextSeq:1,members:[{device:A,name:'Host'},{device:B,name:'Member'}],policy:device===A?null:context.policy()};
  const value={text:'Task #team',done:false,priority:'mid',due:'',assignee:device};const record={id:I,revision:1,value,createdAt:1,updatedAt:1,origin:{device:A,name:'Host'},updatedBy:{device:A,name:'Host'}};service.state.tasks[I]=record;service.state.revision=1;
  service.writeTeamMarkdown=async()=>{};service.readTeamMarkdown=async()=>{};
  return {service,files,fail:value=>{fail=value;}};
}
(async()=>{
  let {service,files,fail}=make();fail('.next');await assert.rejects(service.submit(I,1,{...service.state.tasks[I].value,done:true}));assert.equal(events.length,0);assert.equal(service.state.tasks[I].value.done,false);
  fail('');await service.submit(I,1,{...service.state.tasks[I].value,done:true});assert.equal(events.length,1);assert.equal(events[0].name,'team-todo-completed');assert.equal(events[0].payload.hostCommitted,true);assert.ok(files.has(service.path+'.next'));
  await service.transaction(()=>{});assert.equal(events.length,1,'No-op retries do not emit completion twice.');
  ({service,fail}=make());fail('team-sync-machine.json');await assert.rejects(service.submit(I,1,{...service.state.tasks[I].value,done:true}));assert.equal(events.length,2,'Durable recovery-log commit emits even if the main file fails.');fail('');await service.transaction(()=>{});assert.equal(events.length,2);
  ({service}=make(B));await service.submit(I,1,{...service.state.tasks[I].value,done:true});assert.equal(service.state.pending.length,1);assert.equal(events.length,2,'Unconfirmed member edits never trigger host automation.');
  service.state.policy.syncTodos=false;assert.equal(await service.aiContext(),'','AI context rechecks revoked visibility.');
  console.log('Team host commit, recovery, pending and AI permissions passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
