#!/usr/bin/env node
// render-smoke.test.js — 集成冒烟：完整 mock 宿主环境后加载 dist/main.js，
// 实例化驾驶舱视图并执行 onOpen() -> _renderDashboard -> _buildAll，断言整页构建零异常。
// 72 个既有测试只拼接源码文本、不跑真实 render；本测试填补该空白，
// 能在类似 P4 待办拆分泄漏 ReferenceError 时提前拦截整页空白回归。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const distPath = path.join(root, 'dist', 'main.js');
if (!fs.existsSync(distPath)) { console.log('render-smoke skipped: dist/main.js not built yet (run node build.js).'); process.exit(0); }
const realError = console.error;
const buildErrors = [];
console.error = (...a) => { buildErrors.push(a.map(String).join(' ')); };

const Module=require('module');
const origLoad=Module._load;
// reset debounce/timer noise: provide working setInterval that we track and clear
const _SI=setInterval,_ST=setTimeout,_CI=clearInterval,_CT=clearTimeout;
let timers=new Set();
global.setInterval=(f,ms)=>_SI(f,ms);
global.clearInterval=(id)=>_CI(id);
global.setTimeout=(f,ms,...a)=>_ST(f,ms,...a);
global.clearTimeout=(id)=>_CT(id);

function FakeEl(){
  this.children=[];this.classList={add(){},remove(){},toggle(){},contains(){return false}};
  this.dataset={};this.style={setProperty(){},removeProperty(){},getPropertyValue:()=>''};
  this.textContent='';this.value='';this.options=[];this.selectedIndex=-1;this.checked=false;this.disabled=false;this.onclick=null;
  this.offsetHeight=0;this.offsetWidth=0;this.scrollTop=0;this.scrollHeight=0;
}
const E=FakeEl.prototype;
['createDiv','createEl','createSpan','createSvg','createSvg'].forEach(m=>E[m]=function(tag,o){const c=new FakeEl();if(o&&o.text)c.textContent=o.text;if(o&&o.cls)c._cls=o.cls;return c;});
E.empty=function(){this.children=[];return this};
E.appendChild=function(c){this.children.push(c);return c};
E.append=function(...c){c.forEach(x=>this.children.push(x));return this};
E.appendText=function(){};E.prepend=function(c){this.children.unshift(c);return this};E.insertBefore=function(c){this.children.unshift(c);return c};E.replaceChildren=function(){this.children=[];};E.replaceWith=function(){};E.before=function(){};E.after=function(){};E.contains=function(){return false};E.setAttr=function(){};E.getAttr=function(){return null};
E.setText=function(t){this.textContent=t;return this};
E.addClass=function(){};E.removeClass=function(){};E.toggleClass=function(){};E.toggle=function(){};
E.setAttribute=function(){};E.removeAttribute=function(){};E.hasAttribute=function(){return false};E.getAttribute=function(){return null};
E.querySelector=function(){return null};E.querySelectorAll=function(){return []};
E.addEventListener=function(){};E.removeEventListener=function(){};E.dispatchEvent=function(){};
E.remove=function(){};E.detach=function(){};E.matches=function(){return false};E.closest=function(){return null};
E.focus=function(){};E.blur=function(){};E.scrollIntoView=function(){};
E.getBoundingClientRect=function(){return{left:0,top:0,width:1200,height:800,right:1200,bottom:800}};
E.insertAdjacentElement=function(){};E.insertAdjacentHTML=function(){};E.cloneNode=function(){return new FakeEl()};
E.setCssStyles=function(){};E.setCssProps=function(){};E.setPopup=undefined;
E.createEl2=undefined;
Object.defineProperty(E,'innerHTML',{get(){return ''},set(){}});
Object.defineProperty(E,'firstChild',{get(){return this.children[0]||null}});
E._parent=null;Object.defineProperty(E,'parentElement',{get(){return this._parent||(global.document&&global.document.body)||null}});Object.defineProperty(E,'ownerDocument',{get(){return global.document}});

class Component{registerEvent(){}registerDomEvent(){}registerInterval(){}register(){}}
class Plugin extends Component{constructor(app,manifest){super();this.app=app;this.manifest=manifest;}async loadData(){return{}}async saveData(){}addSettingTab(){}registerView(type,ctor){(global.__VIEWS=global.__VIEWS||[]).push({type,ctor});}addRibbonIcon(){return new FakeEl()}addCommand(){return{}}addStatusBarItem(){return new FakeEl()}registerMarkdownPostProcessor(){}registerEditorExtension(){}registerCodeBlockPostProcessor(){}registerMarkdownCodeBlockProcessor(){}registerObsidianProtocolHandler(){}registerHoverLinkSource(){}}
class PluginSettingTab{}class Modal{}class Notice{constructor(){}}class Setting{}class MarkdownView{}class WorkspaceLeaf{}class ItemView{constructor(leaf){this.leaf=leaf;this.app=(leaf&&leaf.app)||global.__APP__;this.containerEl=(leaf&&leaf.containerEl)||new FakeEl();}registerEvent(){}registerDomEvent(){}registerInterval(){}register(){}addChild(){}onload(){}onunload(){}}
class TFile{constructor(p){this.path=p;this.extension=(p.split('.').pop()||'');this.name=p.split('/').pop();this.basename=this.name.replace(/\.[^.]+$/,'');this.stat={mtime:0,ctime:0,size:0}}}
class TFolder{constructor(p){this.path=p;this.children=[];this.name=p.split('/').pop()}}

// minimal moment
function moment(){const self={_d:new Date(),valueOf:()=>self._d.getTime(),format:()=>'2026-11-17',diff:()=>0,isBefore:()=>false,isAfter:()=>false,add(){return self},subtract(){return self},startOf(){return self},endOf(){return self},clone(){return moment()},day(){return 0},date(){return 1},hour(){return 0},month(){return 0},year(){return 2026},dayOfYear(){return 1},daysInMonth(){return 30},isoWeekday(){return 1},weekday(){return 0},quarter(){return 1},toDate(){return self._d},unix(){return 0},valueOf(){return self._d.getTime()},week(){return 1},isoWeek(){return 1},dayOfWeek(){return 0},format(v){return '2026-11-17'},endOf(){return self},startOf(){return self},isSame:()=>false,isSameOrBefore:()=>false,isValid:()=>true,toISOString:()=>self._d.toISOString(),toDate:()=>self._d,hours(){return 0},minutes(){return 0}};return self;}
moment.locale=()=>{};moment.duration=()=>({asDays:()=>0,asHours:()=>0});
const obs={Plugin,Component,PluginSettingTab,Modal,Notice,Setting,MarkdownView,TFile,TFolder,WorkspaceLeaf,ItemView,
  setIcon(){},Platform:{isMobile:false,isDesktop:true,isMacOS:true,isWin:false,isLinux:false},
  normalizePath:x=>x,moment,requestUrl:async()=>({status:200,json:{},text:''}),Menu:class{},SuggestModal:class{},FuzzySuggestModal:class{},
  debounce:(f)=>{const w=(...a)=>f(...a);w.cancel=()=>{};return w;},MarkdownRenderer:{render:async()=>{}},}
;
Module._load=function(req,p,isMain){if(req==='obsidian')return obs;return origLoad.apply(this,arguments);};

const doc={body:new FakeEl(),head:new FakeEl(),documentElement:new FakeEl(),
  createElement:()=>new FakeEl(),createTextNode:()=>({}),createDocumentFragment:()=>new FakeEl(),
  querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,
  addEventListener(){},removeEventListener(){},getComputedStyle:()=>({getPropertyValue:()=>''})};
global.document=doc;
global.window={innerWidth:1200,innerHeight:800,moment,matchMedia:()=>({matches:false,addEventListener(){}}),
  addEventListener(){},removeEventListener(){},getComputedStyle:doc.getComputedStyle,
  setInterval:global.setInterval,clearInterval:global.clearInterval,setTimeout:global.setTimeout,clearTimeout:global.clearTimeout,
  requestAnimationFrame:(f)=>{try{f(0)}catch(e){}return 1},cancelAnimationFrame(){},getSelection:()=>({removeAllRanges(){},addRange(){}})};
doc.defaultView=global.window;global.requestAnimationFrame=global.window.requestAnimationFrame;
global.cancelAnimationFrame=global.window.cancelAnimationFrame;
global.performance={now:()=>0};global.HTMLElement=FakeEl;global.ResizeObserver=class{constructor(){}observe(){}disconnect(){}unobserve(){}};global.MutationObserver=class{constructor(){}observe(){}disconnect(){}takeRecords(){return[]}};global.IntersectionObserver=class{observe(){}disconnect(){}};global.getComputedStyle=()=>({getPropertyValue:()=>'',width:'1200px'});window.HTMLElement=FakeEl;window.ResizeObserver=global.ResizeObserver;window.MutationObserver=global.MutationObserver;window.IntersectionObserver=global.IntersectionObserver;window.getComputedStyle=global.getComputedStyle;
global.navigator={userAgent:'node'};
global.getSelection=global.window.getSelection;
global.activeWindow=global.window;
global.activeDocument=doc;


function makeMockApp(){
  const files = [new TFile('todos.md'), new TFile('_data/todos.md')];
  return {
      vault:{getAbstractFileByPath:()=>null,adapter:{getBasePath:()=>'/tmp',exists:async()=>false,read:async()=>'',write:async()=>{},mkdir:async()=>{},stat:async()=>({})},
        on:()=>({on(){}}),getFiles:()=>files,getMarkdownFiles:()=>files,getName:()=>'vault',
        getConfig:()=>'',read:async()=>'',cachedRead:async()=>'',modify:async()=>{},create:async(p)=>new TFile(p),createFolder:async()=>{},getAllLoadedFiles:()=>files,getAllFolders:()=>[],getFiles:()=>files,getName:()=>'vault',getRoot:()=>({children:[]})},
      workspace:{onLayoutReady:(cb)=>{try{cb()}catch(e){console.log('layoutReady ERR',e.message)}},on:()=>({on(){}}),
        getLeavesOfType:()=>[],getLeaf:()=>({setViewState:async()=>{},view:{containerEl:new FakeEl(),getViewType(){return'x'}}}),
        getRightLeaf:()=>null,getActiveFile:()=>null,getLastOpenFiles:()=>[],revealLeaf:async()=>{},detachLeavesOfType:()=>{},
        getUnpinnedLeaf:()=>({setViewState:async()=>{},view:{containerEl:new FakeEl()}}),rightSplit:{expand(){}},
        iterateAllLeaves:()=>{},activeLeaf:null,onLayoutReady2:undefined},
      commands:{executeCommandById(){},listCommands:()=>[]},
      setting:{open(){},openTabById(){}},
      isMobile:false,
      metadataCache:{getFileCache:()=>null,on:()=>({on(){}}),getFirstLinkpathDest:()=>null},
      fileManager:{processFrontMatter:async()=>{},generateMarkdownLink:()=>''},
    };
}


(async () => {
  try {
    const P = require(distPath);
    const app = makeMockApp();
    global.__APP__ = app;
    const plugin = new P(app, { id:'cockpit-dashboard', dir:'/tmp', version:'2.4.0', minAppVersion:'1.0.0' });
    await plugin.onload();
    const vs = global.__VIEWS || [];
    const dh = vs.find(v => v.type === 'cockpit-dashboard');
    assert.ok(dh, 'Cockpit dashboard view is registered.');
    const leaf = { containerEl:new FakeEl(), view:null, app };
    leaf.containerEl.children = [new FakeEl(), new FakeEl()];
    // registerView 注册的是工厂闭包 (l => new CockpitView(l, plugin))，不是可 new 的类，按工厂调用。
    const view = dh.ctor(leaf);
    leaf.view = view;
    let threw = null;
    try { await view.onOpen(); } catch (e) { threw = e; }
    console.error = realError;
    if (threw) { realError(threw.stack || threw.message); }
    assert.equal(threw, null, 'Cockpit view onOpen() must render the whole dashboard without throwing: ' + (threw && threw.message));
    const fatal = buildErrors.filter(m => /dashboard build failed/i.test(m));
    assert.equal(fatal.length, 0, '_buildAll must not throw during full render (blank-screen regression): ' + fatal.join(' | '));
    console.log('Render smoke check passed (full dashboard builds without error)');
    // 插件会启动后台定时器（更新检查等）保持事件循环，测试断言完成即显式退出。
    process.exit(0);
  } catch (e) {
    console.error = realError;
    realError(e.stack || e.message);
    process.exit(1);
  }
})();
