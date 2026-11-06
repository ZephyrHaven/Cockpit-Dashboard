const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { migrateCockpitModuleLayout, migrateCockpitDashboardComponents } = require('../src/component-store-core.js');
const { collectCockpitCategories } = require('../src/categories.js');
const { collectCockpitProjects } = require('../src/projects.js');

const legacy = {
  apiKey:'preserve-user-config', weeklyReport:{records:[{id:'existing'}]},
  moduleOrder:['hero','weeklyReview','calendar','reportStudio','footer','recent','runHistory'],
  hiddenModules:['reportStudio','runHistory'], collapsed:{weeklyReview:true,cats:false},
  optionalModulesSeen:['weeklyReview','projects','agenda'],
  sceneLayouts:{work:{name:'Work',layout:{moduleOrder:['hero','weeklyReview','teamStats','reportStudio','recent'],hiddenModules:['reportStudio'],contentWidth:1200,moduleLabels:{cats:'My notes',weeklyReview:'Old review'}}},focus:{layout:{moduleOrder:['reportStudio','weeklyReview','calendar'],hiddenModules:['reportStudio','weeklyReview']}}}
};
const saved = JSON.stringify(legacy);
const migrated = migrateCockpitDashboardComponents(legacy);
assert.equal(JSON.stringify(legacy), saved, 'Migration never mutates the source snapshot.');
assert.deepEqual(migrated.moduleOrder, ['hero','reportStudio','calendar','recent']);
assert.deepEqual(migrated.hiddenModules, [], 'A visible legacy review keeps the merged workspace visible.');
assert.deepEqual(migrated.sceneLayouts.work.layout.moduleOrder, ['hero','reportStudio','recent']);
assert.deepEqual(migrated.sceneLayouts.work.layout.hiddenModules, []);
assert.deepEqual(migrated.sceneLayouts.focus.layout.hiddenModules, ['reportStudio'], 'A scene with both old components hidden stays hidden.');
assert.equal(migrated.sceneLayouts.work.layout.contentWidth,1200);
assert.deepEqual(migrated.sceneLayouts.work.layout.moduleLabels,{cats:'My notes'});
assert.deepEqual(migrated.collapsed,{reportStudio:true,cats:false});
assert.deepEqual(migrated.weeklyReport,legacy.weeklyReport);
assert.equal(migrated.apiKey,legacy.apiKey);
assert.deepEqual(migrateCockpitDashboardComponents(migrated),migrated,'Migration is idempotent.');
assert.equal('moduleOrder' in migrateCockpitDashboardComponents({}),false,'A fresh install is not mistaken for an existing layout.');
assert.equal('sceneLayouts' in migrateCockpitDashboardComponents({}),false);
assert.deepEqual(migrateCockpitModuleLayout({moduleOrder:['weeklyReview','reportStudio'],hiddenModules:['weeklyReview']}).hiddenModules,[],'An already visible report studio remains visible.');

const files=[{path:'01-Work/a.md',basename:'a',stat:{mtime:10}},{path:'01-Work/sub/b.md',basename:'b',stat:{mtime:20}},{path:'Personal/c.md',basename:'c',stat:{mtime:5}},{path:'Root.md',basename:'Root'},{path:'_data/internal.md'}];
const categories=collectCockpitCategories(files,['01-Work','Personal','Empty','_data','.settings','Templates','01-Work/sub'].map(path=>({path,children:[]})));
assert.deepEqual(categories.map(c=>c.path),['01-Work','Empty','Personal']);
assert.equal(categories[0].name,'Work');assert.equal(categories[0].files.length,2);assert.equal(categories[0].updatedAt,20);
assert.equal(categories[1].files.length,0,'Empty folders remain navigable.');

const now=new Date('2026-11-06T12:00:00').valueOf();
const projects=collectCockpitProjects([
  {text:'Due first',tags:['#Work','Work'],done:false,dueDate:new Date('2026-11-06T09:00:00'),dueHasTime:true},
  {text:'All day today',tags:['Work'],done:false,dueDate:new Date('2026-11-06T00:00:00'),dueHasTime:false},
  {text:'Done',tags:['Work','Complete'],done:true},
  {text:'Archived',tags:['Work','_archived'],done:false},
  {text:'Undated',tags:['Personal'],done:false}
],now);
assert.equal(projects[0].tag,'Work');assert.equal(projects[0].total,3,'Repeated tag spellings and archived tasks do not inflate progress.');
assert.equal(projects[0].done,1);assert.equal(projects[0].open,2);assert.equal(projects[0].overdue,1,'An all-day task does not become overdue at midnight of its own day.');
assert.equal(projects.find(p=>p.tag==='Personal').nextTodo.text,'Undated');
assert.equal(projects.find(p=>p.tag==='Complete').open,0);

class El {
  constructor(){this.children=[];this.attr={};this.dataset={};this.hidden=false;this.isConnected=true;}
  createDiv(opts){return this.createEl('div',opts);} createEl(tag,opts={}){const el=new El();el.tag=tag;el.attr={...opts.attr};el.text=opts.text;this.children.push(el);return el;}
  setAttribute(k,v){this.attr[k]=v;} focus(){this.focused=true;}
}
const mounted=[],collapses=[];
const context=vm.createContext({console,PLUGIN_ID:'cockpit-dashboard',buildWeeklyReviewModule:async(view,root,options)=>{mounted.push(['review',options]);},buildWeeklyReportModule:(view,root,options)=>{mounted.push(['report',options]);return ()=>{};}});
vm.runInContext(fs.readFileSync('src/weekly-workspace.js','utf8')+';this.build=buildWeeklyWorkspaceModule;',context);
(async()=>{
  const root=new El();await context.build({_lang:()=> 'en',_t:()=> 'Reports & review',_makeModuleCollapsible:(id)=>collapses.push(id)},root);
  assert.deepEqual(mounted.map(x=>x[0]),['review','report']);assert.ok(mounted.every(x=>x[1].embedded));assert.deepEqual(collapses,['reportStudio']);
  const body=root.children[1],tabs=body.children[0].children,panels=body.children.slice(1);
  assert.equal(panels[0].hidden,false);assert.equal(panels[1].hidden,true);
  tabs[1].onclick();assert.equal(panels[0].hidden,true);assert.equal(panels[1].hidden,false);
  tabs[1].onkeydown({key:'ArrowLeft',preventDefault(){}});assert.equal(panels[0].hidden,false);assert.equal(tabs[0].focused,true);
  console.log('Dashboard migration, category indexing, project cards and merged weekly tabs passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
