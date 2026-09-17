const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element {
  constructor(tag,options={}){this.tag=tag;this.text=options.text||'';this.attr=options.attr||{};this.value=this.attr.value||'';this.children=[];this.dataset={};this.isConnected=true;this.classList={add(){}};}
  createEl(tag,options){const element=new Element(tag,options);this.children.push(element);if(this.tag==='select'&&tag==='option'&&this.children.length===1)this.value=element.value;return element;}
  createDiv(options){return this.createEl('div',options);}createSpan(options){return this.createEl('span',options);}empty(){this.children=[];}setText(text){this.text=text;}addClass(){}find(tag){return this.children.flatMap(el=>[...(el.tag===tag?[el]:[]),...el.find(tag)]);}
}
let opened=0,closed=0,records=[];
class Modal {constructor(app){this.app=app;this.contentEl=new Element('div');}open(){opened++;this.onOpen();}close(){closed++;this.onClose();}}
const notices=[],ctx=vm.createContext({require,module:{exports:{}},console,TextEncoder,URL,Blob,Date,obs:{Modal,ItemView:class{},Plugin:class{},Notice:class{constructor(message){notices.push(message);}}},PLUGIN_ID:'cockpit-dashboard',window:{moment:()=>({format:()=> '2026-09-17'})},parseDate:()=>null});
for(const name of ['team-sync-core','dashboard-insights','todo-bulk','_framework'])vm.runInContext(fs.readFileSync('src/'+name+'.js','utf8'),ctx);
vm.runInContext('this.api={buildTeamInsights,buildRunHistory,buildSyncHealth,buildTodoBulkBar,CockpitDetailModal,registry:CockpitView.prototype._moduleRegistry,cockpitMentionedModules};',ctx);
(async()=>{
  const calls=[],plugin={loadData:async()=>({}),teamSync:{state:{team:null},subscribe:()=>()=>{},status:'Paused'},scheduledTasks:{readLogs:()=>[],subscribe:()=>()=>{}},workflows:{subscribe:()=>()=>{}},lanSync:{store:{state:{doc:{},peers:[]}},listeners:new Set(),status:'Paused'}};
  const view={_plugin:plugin,app:{vault:{}},_lang:()=> 'en',_t:key=>key,_makeModuleCollapsible:(id,title,body)=>{calls.push(id);assert.equal(body.dataset.section,id+'-body');assert.equal(title.dataset.section,id+'-title');}};
  const root=new Element('div');ctx.api.buildTeamInsights(view,root);ctx.api.buildRunHistory(view,root);ctx.api.buildSyncHealth(view,root);await new Promise(resolve=>setImmediate(resolve));
  for(const id of ['teamStats','runHistory','syncHealth']){assert.ok(calls.includes(id));const module=ctx.api.registry.call(view).find(module=>module.id===id);assert.equal(module.collapsible,true);assert.equal(module.matches({dataset:{section:id+'-body'}}),true);}
  assert.ok(root.find('button').some(el=>el.text==='Configure services'));
  assert.equal(ctx.api.cockpitMentionedModules({moduleOrder:['hero'],sceneLayouts:{custom:{layout:{hiddenModules:['teamStats']}}}}).has('runHistory'),false);
  assert.equal(ctx.api.cockpitMentionedModules({sceneLayouts:{custom:{layout:{moduleOrder:['teamStats']}}}}).has('teamStats'),true);
  const modal=new ctx.api.CockpitDetailModal(view,'Details',()=>{});modal.open();assert.equal(plugin._cockpitDetailModals.size,1);let cleanups=0;modal.registerCleanup(()=>cleanups++);modal.close();assert.equal(plugin._cockpitDetailModals.size,0);assert.equal(cleanups,1);modal.registerCleanup(()=>cleanups++);assert.equal(cleanups,2);
  let tasks=[{id:'a',text:'A',tags:[],done:false},{id:'b',text:'B',tags:[],done:true}];view._todoSelection=new Set(['a','b']);view._refreshTodosRef=async()=>{};
  const parent=new Element('div');ctx.api.buildTodoBulkBar(view,parent,tasks,async mutation=>mutation(tasks));
  const [operation]=parent.find('select'),inputs=parent.find('input'),apply=parent.find('button').find(el=>el.text==='Apply');
  operation.value='archive';await apply.onclick();assert.equal(tasks[0].tags.length,0,'Archiving a group with open tasks does not partially archive others.');assert.equal(tasks[1].tags.length,0);
  operation.value='tag';inputs.find(el=>el.attr.type==='text').value='#project';await apply.onclick();assert.equal(tasks.every(task=>task.tags.includes('project')),true);
  assert.equal(view._todoSelection.size,0);
  console.log('Optional module registration, collapse, modal cleanup and bulk controls passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
