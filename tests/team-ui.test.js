const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class Element {
  constructor(tag='div',options={}) { this.tag=tag;this.children=[];this.parent=null;this.dataset={};this.value='';this.attr=options.attr||{};this.text=options.text||'';this.classes=new Set((options.cls||'').split(' ').filter(Boolean));this.classList={contains:v=>this.classes.has(v),add:v=>this.classes.add(v)}; }
  createEl(tag,options={}) { const el=new Element(tag,options);el.parent=this;this.children.push(el);return el; }
  createDiv(options={}) { return this.createEl('div',options); }
  createSpan(options={}) { return this.createEl('span',options); }
  setText(value) { this.text=value; }
  empty() { this.children=[]; }
  addClass(cls) { this.classes.add(cls); }
  querySelectorAll(selector) { const cls=selector.startsWith('.')?selector.slice(1):selector;return this.all().filter(el=>el.classes.has(cls)); }
  remove() { if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this); }
  focus() {}
  all() { return [this,...this.children.flatMap(child=>child.all())]; }
}
class Modal { constructor(app) {this.app=app;this.modalEl=new Element('div',{cls:'modal'});const chrome=this.modalEl.createDiv({cls:'modal-header'});chrome.createEl('button',{cls:'modal-close-button',text:'×'});this.contentEl=this.modalEl.createDiv({cls:'modal-content'});} open(){return this.onOpen();} close(){this.onClose();} }
const notices=[];
const ctx=vm.createContext({console,require,Buffer,setTimeout,clearTimeout,obs:{Modal,Notice:class{constructor(message){notices.push(message);}},ItemView:class{},Plugin:class{}},PLUGIN_ID:'cockpit-dashboard',module:{exports:{}}, navigator:{clipboard:{writeText:async()=>{}}},loadTodos:async()=>[{text:'Personal secret',done:false,tags:[],priority:'mid'}]});
for(const name of ['lan-sync-core','team-sync-core','team-sync-ui','team-todos','_framework']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/'+name+'.js'),'utf8'),ctx);
vm.runInContext('this.build = buildTeamTodosModule;this.Editor = CockpitTeamEditorModal;this.Manager = CockpitTeamModal;this.Share = CockpitTeamShareModal;this.Approval = CockpitTeamApprovalModal;this.registry = CockpitView.prototype._moduleRegistry;',ctx);
const A='a'.repeat(32),B='b'.repeat(32),T='d'.repeat(32);
const now=Date.now();
const record={id:'e'.repeat(32),revision:1,value:{text:'Team sample',done:false,priority:'mid',due:'',assignee:B},origin:{device:B,name:'Bob'},updatedBy:{device:B,name:'Bob'},createdAt:now,updatedAt:now};
const state={device:A,name:'Host',team:{id:T,host:A,name:'Studio'},tasks:{[record.id]:record},pending:[],drafts:[],conflicts:[],peers:[]};
const listeners=new Set();let host=true,opened=null,submitted=null;
const policy=()=>host?{role:'admin',visibility:'all',syncTodos:true,canCreate:true,canDelete:true}:{role:'viewer',visibility:'all',syncTodos:true,canCreate:false,canDelete:false};
const service={state,status:'Online',modals:new Set(),load:async()=>state,isHost:()=>host,policy,members:()=>[{device:A,name:'Host'},{device:B,name:'Bob'}],subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},open(){},openModal:modal=>{opened=modal;service.modals.add(modal);return modal.open();},submit:async(...args)=>{submitted=args;}};
const view={app:{},_plugin:{teamSync:service},_lang:()=> 'zh-CN',_t:key=>key,_makeModuleCollapsible:(id,title,body)=>{view.collapse={id,title,body};}};
(async()=>{
  const root=new Element();await ctx.build(view,root);
  assert.equal(view.collapse.id,'teamTodos');
  const module=ctx.registry.call(view).find(item=>item.id==='teamTodos');
  assert.equal(module.collapsible,true);assert.ok(module.matches(view.collapse.title));assert.ok(module.matches(view.collapse.body));
  assert.ok(root.all().some(el=>el.text.includes('来源：Bob')));
  assert.equal(listeners.size,1);
  const toolbarButton=root.all().find(el=>el.text==='+');
  assert.ok(toolbarButton,'Team creation belongs to the team toolbar');
  service.status='Sync heartbeat';for(const listener of listeners)listener();
  assert.ok(root.all().includes(toolbarButton),'A heartbeat must preserve toolbar DOM and focus');
  record.value.text='Team sample #研发';record.revision++;
  for(const listener of listeners)listener();
  assert.ok(root.all().some(el=>el.text==='#研发'),'Synced tags are available in the team filter');
  record.value.text='Team sample';record.revision=1;
  await ctx.build(view,new Element());assert.equal(listeners.size,1,'Rebuilding must remove the old subscription');
  host=false;const readOnly=new Element();await ctx.build(view,readOnly);
  assert.ok(!readOnly.all().some(el=>['编辑','删除','新建团队待办'].includes(el.text)));
  assert.equal(readOnly.all().find(el=>el.className==='cockpit-dashboard-todo-chk').disabled,true);
  // The editor keeps typed content when network listeners refresh a different subtree.
  host=true;const editor=new ctx.Editor({},service,record);service.modals.add(editor);editor.open();
  assert.equal(editor.modalEl.querySelectorAll('.modal-close-button').length,0,'The host close control is removed from the team editor');
  assert.equal(editor.modalEl.all().filter(el=>el.classes.has('cockpit-dashboard-todo-editor-close')).length,1,'The team editor renders exactly one close control');
  const input=editor.contentEl.all().find(el=>el.tag==='textarea');input.value='Unsaved edit';
  for(const listener of listeners)listener();assert.equal(input.value,'Unsaved edit');
  await editor.contentEl.all().find(el=>el.text==='保存').onclick();
  assert.equal(submitted[0],record.id);assert.equal(submitted[1],1);assert.equal(submitted[2].text,'Unsaved edit');
  const tagged=new ctx.Editor({},service,record);tagged.open();
  const tagInput=tagged.contentEl.all().find(el=>el.attr['aria-label']==='新标签');tagInput.value='项目甲';
  tagged.contentEl.all().find(el=>el.text==='添加标签').onclick();
  tagged.contentEl.all().find(el=>el.text==='低优先级').onclick();
  tagged.contentEl.all().find(el=>el.text==='明天').onclick();
  await tagged.contentEl.all().find(el=>el.text==='保存').onclick();
  assert.ok(submitted[2].text.includes('#项目甲'));
  assert.equal(submitted[2].priority,'low');assert.match(submitted[2].due,/T00:00:00$/);
  const created=new ctx.Editor({},service);created.open();
  assert.equal(created.modalEl.querySelectorAll('.modal-close-button').length,0,'The new-team-task path also removes the host close control');
  assert.equal(created.modalEl.all().filter(el=>el.classes.has('cockpit-dashboard-todo-editor-close')).length,1);
  created.close();
  const reopened=new ctx.Editor({},service,{...record,value:submitted[2]});reopened.open();
  assert.equal(reopened.contentEl.all().find(el=>el.tag==='textarea').value,'Team sample');
  assert.ok(reopened.contentEl.all().some(el=>el.text==='#项目甲 ×'),'Tags survive save and reopen without duplicating in title');
  reopened.close();
  assert.ok(!service.modals.has(editor));
  // Creating a team task is distinct from explicitly sharing a personal one.
  const share=new ctx.Share({},service);service.modals.add(share);await share.open();
  submitted=null;await share.contentEl.all().find(el=>el.classes?.has('cockpit-team-share-row')).onclick();
  assert.ok(opened instanceof ctx.Editor);assert.equal(submitted,null,'Sharing opens a review form before any save');
  assert.equal(opened.initial.text,'Personal secret');opened.close();
  const manager=new ctx.Manager({},service);service.modals.add(manager);await manager.open();
  const deviceInput=manager.contentEl.all().find(el=>el.tag==='input');deviceInput.value='New label';
  for(const listener of listeners)listener();assert.equal(deviceInput.value,'New label');
  manager.close();assert.equal(listeners.size,1);view._teamUnsubscribe();assert.equal(listeners.size,0);
  let approval='unset';const modal=new ctx.Approval({},service,'Bob',value=>approval=value);service.modals.add(modal);modal.open();modal.close();
  assert.equal(approval,false,'Closing approval denies enrollment');
  // A late async module load after view teardown must not retain a listener.
  let release;service.load=()=>new Promise(resolve=>{release=resolve;});
  const late=ctx.build(view,new Element());view._teamBuildToken=null;release(state);await late;assert.equal(listeners.size,0);
  assert.deepEqual(notices,[]);
  console.log('Team UI: module registration, visibility, edit isolation, explicit share and listener cleanup passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
