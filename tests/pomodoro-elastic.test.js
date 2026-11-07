#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

// Exercise the real timer and shell together, including wall-clock recovery,
// custom-minute accounting and idle UI transitions, without a host window.
function setup(session = null, preferences = {}) {
  let now = 1000000, nextId = 1;
  const timeouts = new Map(), intervals = new Map(), listeners = new Map();
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag; this.children = []; this.attrs = {}; this.handlers = {}; this.value = '';
      this.className = ''; this.hidden = false; this.disabled = false;
      this.style = { setProperty(k,v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
      this.classList = {
        contains:n => this.className.split(' ').includes(n),
        add:n => { if (!this.classList.contains(n)) this.className += ' ' + n; },
        remove:n => { this.className = this.className.split(' ').filter(x => x !== n).join(' '); },
        toggle:(n,on) => { if (on ?? !this.classList.contains(n)) this.classList.add(n); else this.classList.remove(n); }
      };
    }
    get isConnected() { return this === document.body || !!this.parent?.isConnected; }
    createEl(tag,o={}) { const el = new Element(tag); el.className = o.cls || ''; el.textContent = o.text || ''; for (const [k,v] of Object.entries(o.attr || {})) el.setAttribute(k,v); this.appendChild(el); return el; }
    createDiv(o) { return this.createEl('div',o); }
    createSpan(o) { return this.createEl('span',o); }
    appendChild(el) { el.parent = this; this.children.push(el); }
    empty() { this.children = []; }
    remove() { this.parent.children = this.parent.children.filter(el => el !== this); this.parent = null; }
    setAttribute(k,v) { this.attrs[k] = String(v); if (k === 'value') this.value = String(v); }
    getAttribute(k) { return this.attrs[k]; }
    get options() { return this.children; }
    addEventListener(k,fn) { (this.handlers[k] ||= []).push(fn); }
    emit(k,event={}) { for (const fn of this.handlers[k] || []) fn({preventDefault(){},type:k,pointerId:1,button:0,pointerType:'mouse',...event}); }
    querySelector(q) { if (q === ':focus-visible') return document.keyboard && this.contains(document.activeElement) ? document.activeElement : null; return this.children.find(el => el.classList.contains(q.slice(1))) || this.children.map(el => el.querySelector(q)).find(Boolean) || null; }
    closest(selector) { return selector.split(',').map(s=>s.trim()).includes(this.tagName) ? this : this.parent?.closest(selector); }
    contains(el) { return this === el || this.children.some(c => c.contains(el)); }
    getBoundingClientRect() { const left=parseFloat(this.style.left)||100, top=parseFloat(this.style.top)||100, width=this.classList.contains('is-orb')?64:parseFloat(this.style['--pomo-width'])||416;return {left,right:left+width,top,bottom:top+64,width,height:64}; }
    get offsetWidth() { return this.getBoundingClientRect().width; }
    get offsetHeight() { return 64; }
    setPointerCapture(id) { this.capture = id; }
    hasPointerCapture(id) { return this.capture === id; }
    releasePointerCapture() { this.capture = null; }
    click() { this.onclick?.(); }
    focus() { document.activeElement = this; }
    blur() { document.activeElement = null; }
  }
  const document = {body:null,activeElement:null,keyboard:false,hidden:false,createElement:tag => new Element(tag),querySelector:q => document.body.querySelector(q),addEventListener:(k,f) => listeners.set(k,f),removeEventListener:k => listeners.delete(k)};
  document.body = new Element('body');
  const window = {innerWidth:1440,innerHeight:900,moment:()=>({format:()=> '2026-11-07'}),addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)};
  const modals = [];
  class Modal {
    constructor() {
      this.containerEl = document.createElement('div'); this.containerEl.className='modal-container';
      this.modalEl = this.containerEl.createDiv({cls:'modal'});
      this.contentEl = this.modalEl.createDiv({cls:'modal-content'});
    }
    open() { document.body.appendChild(this.containerEl); modals.push(this); this.onOpen?.(); }
    close() { this.onClose?.(); if (this.containerEl.parent) this.containerEl.remove(); }
  }
  const completions = []; let saved = null;
  const view = {_pomodoroSession:session,_lang:()=> 'zh-CN',_t:k=>k,_isMobile:()=>false,_todos:[],
    _savePomodoroSession:async s=>{saved=s;},_mutatePluginData:async()=>{},
    _commitPomodoroCompletion:async(c,s)=>{completions.push(c);saved=s;return{entry:c};},_applyPomodoroCompletionToFocusHistory:async()=>{},_plugin:{},...preferences};
  const context = vm.createContext({document,window,console,queueMicrotask,
    Date:class extends Date { static now() { return now; } },
    MutationObserver:class{observe(){}disconnect(){}},
    obs:{Modal,setIcon(){},Notice:class{}},PLUGIN_ID:'cockpit-dashboard',
    pomodoroTaskRef:t=>t?.id?t:null,groupTodayTodos:t=>[{items:t}],getTodoFocusStat:()=>null,canChangePomodoroTask:()=>true,
    setTimeout:(fn,ms)=>{const id=nextId++;timeouts.set(id,{fn,ms});return id;},clearTimeout:id=>timeouts.delete(id),
    setInterval:fn=>{const id=nextId++;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id)
  });
  vm.runInContext(['pomodoro-feedback.js','pomodoro-reminder.js','pomodoro-shell.js','pomodoro.js'].map(file=>fs.readFileSync(path.join(__dirname,'../src',file),'utf8')).join('\n'),context);
  context.view = view;
  const timer = vm.runInContext('createPomodoro(view)',context);
  const find = suffix => timer.querySelector('.cockpit-dashboard-' + suffix);
  return {timer,find,document,view,rebind:()=>vm.runInContext('createPomodoro(view)',context),listeners,timeouts,intervals,completions,modals,saved:()=>saved,
    advance:async ms=>{now+=ms;for(const fn of [...intervals.values()])await fn();for(let turn=0;turn<10;turn++)await Promise.resolve();},
    idle:()=>{for(const [id,item] of [...timeouts])if(item.ms===12000){timeouts.delete(id);item.fn();}},
    duration:minutes=>{const el=find('pomo-duration').children[1];el.value=String(minutes);el.onchange();},
    input:()=>find('pomo-duration').children[1]};
}
(async () => {
  const a = setup();
  a.duration(45);
  const remark = a.find('pomo-remark'); remark.value='Write the proposal'; remark.oninput(); remark.onchange();
  assert.equal(a.saved().totalSeconds,2700);
  assert.equal(a.saved().focusMinutes,45);
  assert.equal(a.saved().remark,'Write the proposal');
  a.find('pomo-start').click();
  assert.ok(a.timer.classList.contains('is-compact'));
  assert.ok(a.input().disabled,'A running duration cannot be edited.');
  const timeBeforeResize = a.saved().remaining, minutesBeforeResize = a.saved().totalSeconds, endBeforeResize = a.saved().endAt;
  const runningStretch = a.find('pomo-stretch-right');
  runningStretch.emit('keydown',{key:'End'});
  assert.equal(a.saved().layoutWidth,680);
  assert.equal(a.saved().totalSeconds,minutesBeforeResize);
  assert.equal(a.saved().remaining,timeBeforeResize);
  assert.equal(a.saved().endAt,endBeforeResize,'Resizing only changes presentation, never the deadline.');
  assert.equal(a.timer.getAttribute('data-pomo-density'),'full');
  a.find('pomo-tools').children[1].click();
  assert.equal(a.saved().minimized,false,'Settings on a wide compact timer expand the actual settings area.');
  assert.equal(a.find('pomo-body').hidden,false);
  a.find('pomo-tools').children[0].click();
  runningStretch.emit('keydown',{key:'Home'});
  assert.equal(a.saved().layoutWidth,216);
  assert.equal(a.timer.getAttribute('data-pomo-density'),'minimal');
  assert.equal(a.find('pomo-compact-time').textContent,'45:00');
  const originalEnd = a.saved().endAt;
  const header = a.find('pomo-header');
  header.emit('pointerdown',{target:a.find('pomo-clock'),clientX:120,clientY:120});
  header.emit('pointermove',{clientX:150,clientY:140});header.emit('pointerup');
  assert.ok(a.timer.style.left,'The timer can still be moved after making it resizable.');
  assert.ok(!a.timer.classList.contains('is-detent'),'Drag feedback ends on release.');
  await a.advance(2500);
  a.find('pomo-tools').children[0].click();
  assert.equal(a.saved().endAt,originalEnd,'UI changes preserve the exact wall-clock deadline.');
  assert.ok(!a.timer.classList.contains('is-compact'));
  assert.equal(a.find('pomo-body').hidden,false,'Expanding opens task, reminder and reset settings.');
  a.find('pomo-tools').children[0].click();
  assert.equal(a.find('pomo-body').hidden,true,'Compacting removes the entire settings area.');
  a.idle(); assert.ok(a.timer.classList.contains('is-orb'));
  a.timer.emit('pointerenter'); assert.ok(!a.timer.classList.contains('is-orb'));
  a.idle(); assert.ok(!a.timer.classList.contains('is-orb'),'Hover keeps seconds visible.');
  a.timer.emit('pointerleave');a.idle(); assert.ok(a.timer.classList.contains('is-orb'));
  a.find('pomo-orb').click();assert.ok(!a.timer.classList.contains('is-orb'),'Touch/click opens the compact controls.');
  a.find('pomo-start').click();
  assert.equal(a.saved().isRunning,false);
  const paused = a.saved().remaining;
  await a.advance(9000);assert.equal(a.saved().remaining,paused);
  a.find('pomo-start').click();
  await a.advance(paused*1000);
  assert.equal(a.completions.length,1);
  assert.equal(a.completions[0].minutes,45,'Custom focus duration is accounted instead of the default 25 minutes.');
  assert.equal(a.saved().isBreak,true);
  assert.equal(a.saved().totalSeconds,300);
  assert.equal(a.saved().awaitingChoice,'focus');
  assert.equal(a.modals.length,1);
  assert.ok(a.timer.classList.contains('is-reminding'),'The timer is excluded from the completion overlay backdrop.');
  assert.ok(!a.timer.style.transform || a.timer.style.transform === 'none','Completion must not transform the glass timer while opening a blur layer.');
  await a.advance(2000);
  assert.equal(a.modals.length,1,'Completion shows one dialog even if another tick arrives.');
  assert.equal(a.completions.length,1,'Completion is committed only once.');
  assert.equal(a.modals[0].options.minutes,45);
  a.timer._cockpitSetReminderVisible('alarm',true);
  a.modals[0].close();
  assert.ok(a.timer.classList.contains('is-reminding'),'A second reminder keeps the timer hidden after the first closes.');
  a.timer._cockpitSetReminderVisible('alarm',false);
  assert.ok(!a.timer.classList.contains('is-reminding'));
  assert.ok(a.modals[0].containerEl.classList.contains('is-half-sheet'),'Ordinary completion uses the lower-half fog layer.');
  assert.ok(!a.modals[0].containerEl.classList.contains('is-fullscreen'));
  assert.ok(!a.timer.classList.contains('is-orb'),'Completion wakes the timer.');
  a.find('pomo-start').click(); await a.advance(300000);
  assert.equal(a.saved().totalSeconds,2700,'The next focus round remembers the chosen duration.');
  assert.equal(a.completions.length,1,'Breaks never add focus minutes.');
  a.timer._cockpitDestroy({preserveSession:true});
  assert.equal(a.timeouts.size,0);assert.equal(a.intervals.size,0);assert.equal(a.listeners.size,0);

  const b = setup({active:true,focusMinutes:90,totalSeconds:5400,remaining:5000,isRunning:true,endAt:1000000+80000,remark:'Recovered note'});
  assert.equal(b.saved().totalSeconds,5400);assert.equal(b.saved().remaining,80);
  assert.equal(b.find('pomo-remark').value,'Recovered note');
  await b.advance(80000);assert.equal(b.completions[0].minutes,90);
  const nextButton = b.modals[0].contentEl.querySelector('.cockpit-dashboard-pomo-reminder-actions').children[1];
  nextButton.click();
  assert.equal(b.saved().isBreak,false);
  assert.equal(b.saved().isRunning,true);
  assert.equal(b.saved().totalSeconds,5400);
  assert.equal(b.completions.length,1,'Skipping the break starts a new session without double counting.');
  b.timer._cockpitDestroy();
  const choice = setup({active:true,isBreak:true,totalSeconds:300,focusMinutes:45,remaining:300,awaitingChoice:'focus'});
  assert.equal(choice.modals.length,1,'The unfinished choice returns after a reload.');
  choice.modals[0].contentEl.querySelector('.cockpit-dashboard-pomo-reminder-actions').children[0].click();
  assert.equal(choice.saved().isRunning,true);assert.equal(choice.saved().isBreak,true);
  choice.timer._cockpitDestroy();
  const dismiss = setup({active:true,isBreak:true,totalSeconds:300,remaining:300,awaitingChoice:'focus'});
  dismiss.modals[0].close();assert.equal(dismiss.saved().awaitingChoice,null);assert.equal(dismiss.saved().isRunning,false);
  dismiss.timer._cockpitDestroy();
  const full = setup({active:true,isBreak:true,totalSeconds:300,remaining:300,awaitingChoice:'focus'}, {_pomodoroFullscreen:true});
  assert.ok(full.modals[0].containerEl.classList.contains('is-fullscreen'),'Only the explicit full-screen setting selects the full overlay.');
  assert.ok(!full.modals[0].containerEl.classList.contains('is-half-sheet'));
  full.timer._cockpitDestroy();
  const seconds = setup({active:true,totalSeconds:120,focusMinutes:2,remaining:61,isRunning:true,endAt:1061000});
  assert.equal(seconds.find('pomo-compact-time').textContent,'01:01');
  assert.ok(seconds.find('pomo-orb-hand'),'The idle dial has a second hand instead of a sector fill.');
  assert.equal(seconds.timer.style['--pomo-hand-angle'],'354deg');
  await seconds.advance(1000);assert.equal(seconds.timer.style['--pomo-hand-angle'],'360deg');
  await seconds.advance(1000);assert.equal(seconds.timer.style['--pomo-hand-angle'],'366deg','The hand keeps moving forward across minute boundaries.');
  assert.equal(seconds.find('pomo-compact-time').textContent,'00:59');
  seconds.timer._cockpitDestroy();
  const hours = setup({active:true,totalSeconds:7200,focusMinutes:120,remaining:3601,isRunning:true,endAt:4601000});
  assert.equal(hours.find('pomo-compact-time').textContent,'01:00:01');
  hours.find('pomo-stretch-right').emit('keydown',{key:'Home'});assert.equal(hours.saved().layoutWidth,248,'Hour-length times retain room for all controls.');
  await hours.advance(2000);assert.equal(hours.find('pomo-compact-time').textContent,'59:59');
  hours.find('pomo-stretch-right').emit('keydown',{key:'Home'});assert.equal(hours.saved().layoutWidth,216);
  hours.timer._cockpitDestroy();
  const legacy = setup({active:true,remaining:1000,isRunning:false});
  legacy.find('pomo-tools').children[0].click();
  assert.equal(legacy.saved().totalSeconds,1500,'Legacy sessions retain the standard focus duration.');
  legacy.find('pomo-reset').click(); legacy.duration(500);assert.equal(legacy.saved().focusMinutes,120);
  legacy.duration('');assert.equal(legacy.saved().focusMinutes,120,'Empty input keeps the previous valid duration.');
  legacy.duration(1);assert.equal(legacy.saved().focusMinutes,1);
  const stretch = legacy.find('pomo-stretch-right');
  stretch.emit('keydown',{key:'ArrowRight'});assert.equal(legacy.saved().focusMinutes,2);
  stretch.emit('pointerdown',{clientX:500});stretch.emit('pointermove',{clientX:555});stretch.emit('pointerup');
  assert.ok(legacy.saved().focusMinutes>2,'Stretching increases duration.');
  assert.ok(!legacy.timer.classList.contains('is-stretching'));
  const beforeLeft = legacy.saved().focusMinutes;
  const leftStretch = legacy.find('pomo-stretch-left');
  leftStretch.emit('pointerdown',{clientX:500});leftStretch.emit('pointermove',{clientX:470});leftStretch.emit('pointerup');
  assert.ok(legacy.saved().focusMinutes>beforeLeft,'The left edge stretches outward with the right edge anchored.');
  legacy.find('pomo-start').focus();legacy.document.keyboard=false;
  legacy.find('pomo-start').click();legacy.idle();
  assert.ok(legacy.timer.classList.contains('is-orb'),'Mouse focus left by Start does not prevent idle collapse.');
  legacy.timer.emit('pointerenter'); legacy.timer.emit('pointerleave');
  legacy.document.keyboard=true;legacy.find('pomo-start').focus();legacy.timer.emit('focusin');legacy.idle();
  assert.ok(!legacy.timer.classList.contains('is-orb'),'Keyboard navigation keeps controls available.');
  legacy.timer._cockpitDestroy();
  // Hand shrinking is persistent; automatic idle shrinking remains temporary.
  const pinned = setup();pinned.find('pomo-start').click();
  const edge = pinned.find('pomo-stretch-right');edge.emit('keydown',{key:'Home'});
  const originalDeadline = pinned.saved().endAt;
  edge.emit('pointerdown',{clientX:500});edge.emit('pointermove',{clientX:450});
  assert.ok(pinned.timer.classList.contains('is-orb-ready'));
  edge.emit('pointercancel');assert.equal(pinned.saved().displayMode,'simple','Cancelling a shrink must not pin it.');
  edge.emit('pointerdown',{clientX:500});edge.emit('pointermove',{clientX:450});edge.emit('pointerup');
  assert.equal(pinned.saved().displayMode,'minimal');assert.equal(pinned.saved().endAt,originalDeadline);
  pinned.timer.emit('pointerenter');pinned.timer.emit('focusin');
  assert.ok(pinned.timer.classList.contains('is-orb'),'Hover and focus do not expand the manually pinned dial.');
  const orb = pinned.find('pomo-orb');
  const beforeOrbDrag = pinned.timer.getBoundingClientRect();
  orb.emit('pointerdown',{clientX:110,clientY:110});orb.emit('pointermove',{clientX:150,clientY:140});orb.emit('pointerup');
  assert.equal(pinned.saved().displayMode,'minimal');
  assert.equal(pinned.saved().position.left,beforeOrbDrag.left+40);assert.equal(pinned.saved().position.top,beforeOrbDrag.top+30);
  orb.click();assert.equal(pinned.saved().displayMode,'minimal','Releasing a drag cannot trigger the expand click.');
  await pinned.advance(1000);assert.equal(pinned.timer.style.left,(beforeOrbDrag.left+40)+'px');
  pinned.timer._cockpitDestroy({preserveSession:true});
  const restoredPinned = setup(JSON.parse(JSON.stringify(pinned.saved())));
  assert.ok(restoredPinned.timer.classList.contains('is-pinned-minimal'));
  assert.equal(restoredPinned.timer.style.left,(beforeOrbDrag.left+40)+'px');assert.equal(restoredPinned.timer.style.top,(beforeOrbDrag.top+30)+'px');
  restoredPinned.find('pomo-orb').click();assert.equal(restoredPinned.saved().displayMode,'simple');
  assert.ok(!restoredPinned.timer.classList.contains('is-orb'));
  restoredPinned.find('pomo-tools').children[0].click();assert.equal(restoredPinned.saved().displayMode,'normal');
  assert.equal(restoredPinned.find('pomo-body').hidden,false);
  restoredPinned.timer._cockpitDestroy();
  const normal = setup({active:true,displayMode:'normal',isRunning:true,totalSeconds:1500,remaining:100,endAt:1100000});
  assert.ok(!normal.timer.classList.contains('is-compact'),'Restoring a running normal timer preserves its presentation.');normal.timer._cockpitDestroy();
  // Rebinds and repeated focus/break transitions never create another timer or active dialog.
  const repeated = setup({active:true,displayMode:'minimal',isRunning:true,totalSeconds:60,focusMinutes:1,remaining:60,endAt:1060000,position:{left:300,top:200}});
  for(let cycle=0;cycle<8;cycle++) {
    assert.equal(repeated.rebind(),repeated.timer);
    await repeated.advance(60000);
    assert.equal(repeated.completions.length,cycle+1);
    assert.equal(repeated.document.body.children.filter(el=>el.classList.contains('cockpit-dashboard-pomodoro')).length,1);
    assert.equal(repeated.document.body.children.filter(el=>el.classList.contains('cockpit-dashboard-pomo-reminder-container')).length,1);
    assert.ok(repeated.timer.classList.contains('is-reminding'));
    repeated.modals.at(-1).contentEl.querySelector('.cockpit-dashboard-pomo-reminder-actions').children[0].click();
    assert.equal(repeated.saved().displayMode,'minimal');assert.ok(!repeated.timer.classList.contains('is-reminding'));
    assert.equal(repeated.saved().position.left,300);assert.equal(repeated.saved().position.top,200);
    await repeated.advance(300000);
    repeated.modals.at(-1).contentEl.querySelector('.cockpit-dashboard-pomo-reminder-actions').children[0].click();
    assert.equal(repeated.saved().displayMode,'minimal');
  }
  repeated.timer._cockpitDestroy();assert.equal(repeated.intervals.size,0);assert.equal(repeated.listeners.size,0);
  // Native feedback reuses one worker per gesture, throttles ticks and always tears down.
  let feedbackNow=0, launches=0, kills=0, writes=0;
  const workers=[];const timers=new Map();let feedbackTimer=0;
  const nativeContext=vm.createContext({console,window:{matchMedia:()=>({matches:false})},process:{platform:'darwin'},
    Date:{now:()=>feedbackNow},
    require:()=>({spawn:(file,args,opts)=>{
      assert.equal(file,'/usr/bin/osascript');assert.equal(opts.stdio[0],'pipe');
      const worker=new EventEmitter();worker.stdout=new EventEmitter();worker.stdin=new EventEmitter();
      worker.stdin.write=()=>{writes++;};worker.stdin.destroy=()=>{};worker.kill=()=>{kills++;};
      workers.push(worker);launches++;return worker;
    }}),
    setTimeout:(fn)=>{timers.set(++feedbackTimer,fn);return feedbackTimer;},clearTimeout:id=>timers.delete(id)});
  nativeContext.element=legacy.timer;
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/pomodoro-feedback.js'),'utf8')+'\nvar feedback=createPomodoroFeedback(element);',nativeContext);
  const feedback=nativeContext.feedback;feedback.tick();workers[0].stdout.emit('data','ready');
  feedback.tick();assert.equal(writes,1,'Ticks are throttled.');feedbackNow=100;feedback.tick();
  assert.equal(launches,1);assert.equal(writes,2);feedback.end();assert.equal(kills,1);assert.equal(timers.size,0);
  feedbackNow=200;feedback.tick();workers[1].stdout.emit('data','ready');feedback.destroy();
  assert.equal(launches,2);assert.equal(kills,2);assert.equal(timers.size,0);
  feedbackNow=400;feedback.tick();assert.equal(launches,2,'Unloaded widgets cannot start another worker.');
  console.log('Elastic Pomodoro duration, recovery, accounting, idle modes and cleanup passed');
})().catch(error=>{console.error(error);process.exit(1);});
