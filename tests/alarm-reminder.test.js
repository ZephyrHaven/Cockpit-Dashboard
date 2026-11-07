#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../src/alarm-core.js');

function setup(data = {}, fullscreen = 'reject') {
  let nextTimer = 0, requests = 0, exits = 0, closedAudio = 0, resolveFullscreen;
  const intervals = new Map(), listeners = new Map();
  class Element {
    constructor(tag='div') {
      this.tagName=tag;this.children=[];this.className='';this.attrs={};this.handlers={};this.style={};this.dataset={};this.hidden=false;this.value='';
      this.classList={contains:n=>this.className.split(' ').includes(n),add:n=>{if(!this.classList.contains(n))this.className+=' '+n;},remove:n=>{this.className=this.className.split(' ').filter(v=>v!==n).join(' ');},toggle:(n,on)=>{if(on??!this.classList.contains(n))this.classList.add(n);else this.classList.remove(n);}};
    }
    get isConnected(){return this===document.body||!!this.parent?.isConnected;}
    createEl(tag,o={}){const e=new Element(tag);e.className=o.cls||'';e.textContent=o.text||'';for(const[k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);this.appendChild(e);return e;}
    createDiv(o){return this.createEl('div',o);}createSpan(o){return this.createEl('span',o);}
    appendChild(e){e.parent=this;this.children.push(e);}empty(){this.children.forEach(e=>e.parent=null);this.children=[];}
    remove(){this.parent.children=this.parent.children.filter(e=>e!==this);this.parent=null;}
    setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k];}
    addEventListener(k,fn){(this.handlers[k]||=[]).push(fn);}
    emit(k,e={}){const event={preventDefault(){},stopPropagation(){},target:this,...e};for(const fn of this.handlers[k]||[])fn(event);}
    click(){this.onclick?.({preventDefault(){},stopPropagation(){},target:this});this.emit('click');}
    focus(){document.activeElement=this;}
    querySelector(q){const match=e=>q.startsWith('.')?e.classList.contains(q.slice(1)):e.tagName===q;return this.children.find(match)||this.children.map(e=>e.querySelector(q)).find(Boolean)||null;}
  }
  const document={body:null,activeElement:null,hidden:false,fullscreenElement:null,hasFocus:()=>true,createElement:t=>new Element(t),querySelector:q=>document.body.querySelector(q),
    addEventListener:(k,f)=>{(listeners.get(k)||listeners.set(k,new Set()).get(k)).add(f);},removeEventListener:(k,f)=>listeners.get(k)?.delete(f)};
  document.body=new Element('body');document.documentElement=new Element('html');
  document.documentElement.requestFullscreen=()=>{requests++;if(fullscreen==='grant'){document.fullscreenElement=document.documentElement;return Promise.resolve();}if(fullscreen==='manual')return new Promise(resolve=>{resolveFullscreen=()=>{document.fullscreenElement=document.documentElement;resolve();};});return Promise.reject(new Error('gesture required'));};
  document.exitFullscreen=()=>{exits++;document.fullscreenElement=null;return Promise.resolve();};
  class Audio {
    constructor(){this.state='running';this.currentTime=0;this.destination={};}
    createOscillator(){return {frequency:{value:0},connect(){},start(){},stop(){}};}
    createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
    close(){closedAudio++;return Promise.resolve();}
  }
  const window={setInterval:fn=>{intervals.set(++nextTimer,fn);return nextTimer;},addEventListener:document.addEventListener,removeEventListener:document.removeEventListener,focus(){},AudioContext:Audio};
  const plugin={app:{workspace:{getLeavesOfType:()=>[{view:{_lang:()=> 'zh-CN'}}]}},loadData:async()=>JSON.parse(JSON.stringify(data)),mutateData:async fn=>{await fn(data);},registerInterval(){}};
  const ctx=vm.createContext({console,document,window,PLUGIN_ID:'cockpit-dashboard',VIEW_TYPE:'cockpit',DEFAULT_LANG:'zh-CN',...core,
    obs:{setIcon(){},Notice:class{}},require:()=>({}),setTimeout:fn=>{fn();return 0;},clearInterval:id=>intervals.delete(id)});
  const api=vm.runInContext(['alarm-core.js','alarm-reminder.js','alarm.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n')+'\n({AlarmOverlayRuntime,AlarmService,buildAlarmModule})',ctx);
  const runtime=new api.AlarmOverlayRuntime(plugin),service=new api.AlarmService(plugin);
  return {api,runtime,service,plugin,document,window,intervals,listeners,data,requests:()=>requests,exits:()=>exits,closedAudio:()=>closedAudio,grant:()=>resolveFullscreen?.(),
    find:(root,suffix)=>root.querySelector('.cockpit-dashboard-'+suffix),flush:async()=>{for(let i=0;i<8;i++)await Promise.resolve();}};
}
(async()=>{
  assert.deepEqual(core.normalizeAlarmReminderSettings(null),{displayMode:'fullscreen'},'Old installations retain full screen.');
  assert.deepEqual(core.normalizeAlarmReminderSettings({displayMode:'invalid'}),{displayMode:'fullscreen'});
  const half=setup();let snoozes=0,stops=0;
  const opener=half.document.body.createEl('button');opener.focus();
  const float=half.document.body.createDiv({cls:'cockpit-dashboard-pomodoro'});const owners=new Set(['pomodoro']);
  float._cockpitSetReminderVisible=(owner,visible)=>visible?owners.add(owner):owners.delete(owner);
  half.runtime.enqueue({id:'one',title:'每日复盘',displayMode:'half',onSnooze:()=>snoozes++,onStop:()=>stops++});
  assert.ok(half.runtime.overlay.classList.contains('is-half-sheet'));assert.equal(half.requests(),0);
  assert.ok(owners.has('alarm'));assert.equal(half.intervals.size,2,'Both clock and sound run while ringing.');
  const buttons=half.find(half.runtime.overlay,'alarm-actions').children;
  assert.equal(half.document.activeElement,buttons[0]);
  buttons[1].focus();half.runtime.overlay.emit('keydown',{key:'Tab'});assert.equal(half.document.activeElement,buttons[0]);
  half.runtime.overlay.emit('keydown',{key:'Tab',shiftKey:true});assert.equal(half.document.activeElement,buttons[1]);
  half.runtime.enqueue({id:'two',title:'第二个闹钟',displayMode:'half',onStop:()=>stops++});
  half.runtime.enqueue({id:'two',title:'重复',displayMode:'half'});assert.equal(half.runtime.queue.length,1);
  half.runtime.overlay.emit('keydown',{key:'Enter',target:buttons[1]});
  assert.equal(snoozes,1);assert.equal(half.runtime.active.id,'two');
  half.runtime.overlay.emit('keydown',{key:'Escape'});assert.equal(stops,1);
  assert.equal(half.intervals.size,0);assert.equal(half.closedAudio(),2);assert.equal(half.document.activeElement,opener);
  assert.ok(!owners.has('alarm')&&owners.has('pomodoro'),'Alarm cleanup does not reveal a timer hidden by another reminder.');
  assert.equal(half.requests(),0);assert.equal(half.listeners.get('pointerdown')?.size||0,0);
  const full=setup({},'grant');
  full.runtime.enqueue({id:'full',title:'全屏',displayMode:'fullscreen'});await full.flush();
  assert.equal(full.requests(),1);assert.ok(full.runtime.enteredFullscreen);
  full.runtime.enqueue({id:'full-next',title:'下一条',displayMode:'fullscreen'});
  full.runtime.dismiss();assert.ok(full.document.fullscreenElement,'Consecutive full-screen alarms avoid a window-size flicker.');
  full.runtime.dismiss();assert.equal(full.exits(),1);assert.equal(full.intervals.size,0);
  assert.equal(full.listeners.get('pointerdown').size,0);
  const late=setup({},'manual');let destroyedAction=0;
  late.runtime.enqueue({id:'late',displayMode:'fullscreen',onStop:()=>destroyedAction++});late.runtime.destroy();late.grant();await late.flush();
  assert.equal(late.exits(),1,'A late full-screen grant is released after unload.');assert.equal(destroyedAction,0);assert.equal(late.intervals.size,0);
  const queued=setup({},'manual');
  queued.runtime.enqueue({id:'pending-full',displayMode:'fullscreen'});queued.runtime.enqueue({id:'queued-half',displayMode:'half'});queued.runtime.dismiss();queued.grant();await queued.flush();
  assert.equal(queued.runtime.active.displayMode,'half');assert.equal(queued.document.fullscreenElement,null);queued.runtime.destroy();

  const config=setup({alarms:[{id:'a',name:'起身',scheduleType:'daily',time:'08:00',enabled:true}],other:{keep:true}});
  await config.service.saveReminderSettings({displayMode:'half'});
  assert.equal(config.data.alarmReminderSettings.displayMode,'half');assert.ok(config.data.other.keep);assert.equal(config.data.alarms.length,1);
  const reloaded=new config.api.AlarmService(config.plugin);await reloaded.ring(config.data.alarms[0]);
  assert.equal(reloaded.overlay.active.displayMode,'half');assert.equal(config.requests(),0);
  reloaded.overlay.dismiss('snooze');await config.flush();assert.ok(config.data.alarms[0].snoozedUntil,'Snooze still updates the persisted alarm.');
  await reloaded.saveReminderSettings({displayMode:'fullscreen'});await reloaded.ring(config.data.alarms[0],true);
  assert.equal(reloaded.overlay.active.displayMode,'fullscreen');assert.equal(reloaded.overlay.active.allowSnooze,false);
  assert.equal(config.find(reloaded.overlay.overlay,'alarm-actions').children.length,1,'Preview has no scheduling actions.');reloaded.stop();
  const stopDuringRead=setup();let finishRead;
  stopDuringRead.plugin.loadData=()=>new Promise(resolve=>{finishRead=resolve;});
  const pending=stopDuringRead.service.ring({id:'unload',name:'卸载'});stopDuringRead.service.stop();finishRead({});await pending;
  assert.equal(stopDuringRead.service.overlay.overlay,null,'Settings reads cannot resurrect an unloaded reminder.');

  const ui=setup({alarmReminderSettings:{displayMode:'half'}}),root=ui.document.body.createDiv();ui.plugin.alarms=ui.service;
  let collapseCalls=0;
  const view={_plugin:ui.plugin,_lang:()=> 'zh-CN',_t:()=> '闹钟',_alarmUnsubscribe:null,_makeModuleCollapsible:(id,title,content)=>{collapseCalls++;assert.equal(id,'alarms');title.setAttribute('aria-expanded','false');content.style.display='none';title.addEventListener('click',()=>{title.setAttribute('aria-expanded','true');content.style.display='';});}};
  await ui.api.buildAlarmModule(view,root);
  const settingsButton=ui.find(root,'alarm-title-actions').children[0];settingsButton.click();
  const settings=ui.find(root,'alarm-settings');assert.equal(settings.hidden,false);assert.equal(ui.find(root,'alarms').style.display,'');
  const select=settings.querySelector('select');assert.equal(select.value,'half');select.value='fullscreen';await select.onchange();await ui.flush();
  assert.equal(ui.data.alarmReminderSettings.displayMode,'fullscreen');assert.equal(select.disabled,false);assert.equal(collapseCalls,1);
  const beforeFailure=select.value;ui.plugin.mutateData=async()=>{throw new Error('disk failure');};select.value='half';await select.onchange();assert.equal(select.value,beforeFailure);assert.ok(ui.find(root,'alarm-settings-error').textContent);
  ui.service.stop();view._alarmUnsubscribe?.();
  console.log('Alarm fog mode settings, queue, snooze, focus, fullscreen races and unload checks passed');
})().catch(error=>{console.error(error);process.exit(1);});
