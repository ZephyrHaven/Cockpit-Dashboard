#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let reduced = false;
const listeners = new Map();
const context = vm.createContext({
  console,
  PLUGIN_ID:'cockpit-dashboard',
  VIEW_TYPE:'cockpit-dashboard',
  window:{
    matchMedia:() => ({ matches:reduced }),
    requestAnimationFrame:(callback) => { callback(0); return 1; },
    cancelAnimationFrame:() => {}
  },
  document:{ hidden:false, addEventListener:(name, handler) => listeners.set(name, handler) },
  requestAnimationFrame:(callback) => { callback(0); return 1; },
  cancelAnimationFrame:() => {},
  performance:{ now:() => 0 },
  setTimeout:() => 1,
  clearTimeout:() => {},
  Set, Map, WeakMap, Object, Array, Math
});
const source = fs.readFileSync(path.join(__dirname, '../src/motion.js'), 'utf8');
vm.runInContext(source + ';globalThis.motionApi={cockpitMotionEnabled,cockpitMotionAllowed,cockpitApplyMotionState,cockpitCaptureLayout,cockpitBindCinematicMotion,cockpitPlayEntrance,cockpitRevealList,cockpitReplayMotion,cockpitAnimatePopover,cockpitClosePopover,cockpitFlightCurve,cockpitFlightPoint,cockpitFlightAngle,cockpitFlyPaperPlane,cockpitCelebrate,COCKPIT_MOTION};', context);
const api = context.motionApi;

assert.equal(api.cockpitMotionEnabled({ _motionV2Enabled:true }), true);
assert.equal(api.cockpitMotionEnabled({ _motionV2Enabled:false }), false);
context.__cockpitMotionV2Enabled = false;
assert.equal(api.cockpitMotionEnabled({}), false, 'The global master switch also covers overlays without a view owner.');
context.__cockpitMotionV2Enabled = true;
assert.equal(api.cockpitMotionAllowed({ _motionV2Enabled:true }), true);
reduced = true;
assert.equal(api.cockpitMotionAllowed({ _motionV2Enabled:true }), false, 'System Reduce Motion overrides enhanced motion.');
reduced = false;
context.document.hidden = true;
assert.equal(api.cockpitMotionAllowed({ _motionV2Enabled:true }), false, 'Hidden pages do not start new motion.');
context.document.hidden = false;

reduced = true;
assert.equal(api.cockpitCelebrate({ isConnected:true }, { _motionV2Enabled:true }), false, 'Reduce Motion skips the completion burst entirely.');
reduced = false;
assert.equal(api.cockpitCelebrate(null, { _motionV2Enabled:true }), false, 'The completion burst needs a live anchor node.');

const classes = new Set();
const root = { dataset:{}, classList:{ toggle:(name, on) => on ? classes.add(name) : classes.delete(name) } };
api.cockpitApplyMotionState(root, { _motionV2Enabled:true });
assert.equal(root.dataset.motion, 'full');
assert.equal(classes.has('ck-motion-v2'), true);
api.cockpitApplyMotionState(root, { _motionV2Enabled:false });
assert.equal(root.dataset.motion, 'off');

assert.equal(api.COCKPIT_MOTION.ui <= 300, true);
assert.equal(api.COCKPIT_MOTION.popover, 180, 'Small popovers use the shared 180ms entrance token.');
assert.equal(api.COCKPIT_MOTION.exit, 180, 'Secondary surfaces share the 180ms exit token.');
assert.equal(api.COCKPIT_MOTION.layout, 320);
assert.equal(api.COCKPIT_MOTION.dialog, 320, 'Secondary dialogs use the shared 320ms entrance token.');
assert.equal(typeof api.cockpitBindCinematicMotion, 'function', 'Cinematic pointer lighting must remain centralized.');
assert.equal(typeof api.cockpitReplayMotion, 'function', 'Users need an explicit way to replay the motion system.');

let popoverRun = null;
const fakeAnimation = () => ({ addEventListener(){}, cancel(){} });
const trigger = { getBoundingClientRect:() => ({left:100,top:20,width:40,height:20}) };
const popover = {
  style:{},
  getBoundingClientRect:() => ({left:80,top:40,width:180,height:120}),
  animate(frames, options) { popoverRun={frames,options}; return fakeAnimation(); }
};
api.cockpitAnimatePopover(popover,trigger,{_motionV2Enabled:true});
assert.equal(popoverRun.options.duration,180);
assert.equal(popoverRun.frames[0].transform,'translateY(-6px) scale(.96)');
assert.equal(popoverRun.frames.length,2,'Popover entrance has one surface animation without a second overshoot phase.');
assert.equal(popoverRun.options.fill,'backwards','Finished popovers release their animated compositor layer.');
reduced=true;popoverRun=null;
api.cockpitAnimatePopover(popover,trigger,{_motionV2Enabled:true});
assert.equal(popoverRun.options.duration,180);
assert.equal(Object.keys(popoverRun.frames[0]).join(','),'opacity','Reduced motion keeps opacity while removing geometric movement.');
reduced=false;

const entranceRuns = [];
const entranceElement = () => ({ animate(frames, options) { entranceRuns.push({frames, options}); return fakeAnimation(); } });
const entranceHero = entranceElement();
const entranceModule = entranceElement();
const entranceRoot = {
  dataset:{glass:'on'},
  classList:{add(){},remove(){}},
  animate(){},
  querySelector:() => entranceHero,
  querySelectorAll:() => [entranceModule]
};
api.cockpitPlayEntrance(entranceRoot,{_motionV2Enabled:true});
assert.equal(entranceRuns.length,2);
assert.equal(entranceRuns.every(({frames,options}) => options.fill === 'backwards' && frames.every((frame) => !('filter' in frame) && !('clipPath' in frame) && !('transform' in frame))),true,'Glass entrances release their compositor effect and never blur scrolling content.');
entranceRuns.length=0;
entranceRoot.dataset.glass='off';
api.cockpitPlayEntrance(entranceRoot,{_motionV2Enabled:true});
assert.equal(entranceRuns.some(({frames}) => frames.some((frame) => 'filter' in frame)),true,'The regular entrance remains available outside glass mode.');
assert.equal(entranceRuns.every(({options}) => options.fill === 'backwards'),true,'Finished entrances must not retain animated layers.');

entranceRuns.length=0;
const list = {
  closest:(selector) => selector.includes('data-glass="on"') ? {} : null,
  querySelectorAll:() => [entranceModule]
};
api.cockpitRevealList(list,'.cockpit-dashboard-workflow-card',{_motionV2Enabled:true});
assert.equal(entranceRuns.length,0,'Glass workflow cards do not animate filtered layers while scrolling.');
list.closest=() => null;
api.cockpitRevealList(list,'.cockpit-dashboard-workflow-card',{_motionV2Enabled:true});
assert.equal(entranceRuns[0].options.fill,'backwards','Finished list reveals release their compositor layers.');

assert.match(source,/getComputedStyle\?\.\(target\)\?\.position/, 'Ripple hosts inspect computed positioning before adding a relative-position helper.');
assert.match(source,/ck-motion-ripple-host/, 'Only actual ripple hosts opt into clipping.');
assert.match(source,/classList\.remove\('ck-motion-ripple-host'\)/, 'Ripple clipping is removed after the feedback finishes.');
assert.match(source,/content-resize-handle'\)\) return;/, 'The absolute dashboard resize handle opts out before press transforms or ripple clipping.');
assert.match(source,/cal-rss-btn'\)\) return;/, 'Calendar RSS keeps press feedback but skips the clipping ripple.');

// 纸飞机投递：拖拽落点后的弧线由纯几何函数驱动，可在没有 DOM 的环境里逐点验证。
const flightCurve = api.cockpitFlightCurve({ x:100, y:500 }, { x:400, y:120 });
assert.equal(flightCurve.start.x, 100);
assert.equal(flightCurve.start.y, 500);
assert.equal(flightCurve.end.x, 400);
assert.equal(flightCurve.end.y, 120);
assert.equal(Math.round(flightCurve.control.x), 250, 'The arc peaks above the horizontal midpoint.');
assert.equal(flightCurve.control.y < 120, true, 'The control point lifts the path above both ends.');
assert.equal(flightCurve.distance > 400, true);

const flightStart = api.cockpitFlightPoint(flightCurve, 0);
const flightEnd = api.cockpitFlightPoint(flightCurve, 1);
assert.equal(flightStart.x, 100); assert.equal(flightStart.y, 500);
assert.equal(flightEnd.x, 400); assert.equal(flightEnd.y, 120);
assert.equal(api.cockpitFlightPoint(flightCurve, .5).y < 310, true, 'Mid-flight stays above the straight chord.');
assert.equal(api.cockpitFlightPoint(flightCurve, -1).x, 100, 'Progress below zero clamps to the take-off point.');
assert.equal(api.cockpitFlightPoint(flightCurve, 2).x, 400, 'Progress above one clamps to the landing point.');

let turning = 0;
let previousPoint = api.cockpitFlightPoint(flightCurve, 0);
let previousAngle = null;
for (let step = 1; step <= 200; step += 1) {
  const point = api.cockpitFlightPoint(flightCurve, step / 200);
  const angle = Math.atan2(point.y - previousPoint.y, point.x - previousPoint.x);
  if (previousAngle !== null) {
    let delta = angle - previousAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    turning += delta;
  }
  previousAngle = angle;
  previousPoint = point;
}
assert.equal(Math.abs(turning) > Math.PI * 3, true, 'The route banks through two full loops instead of one flat arc.');
const takeOffAngle = api.cockpitFlightAngle(flightCurve, 0);
const landingAngle = api.cockpitFlightAngle(flightCurve, 1);
assert.equal(takeOffAngle < 0 && takeOffAngle > -90, true, 'The plane noses upward when it takes off.');
assert.equal(landingAngle > 0, true, 'The plane noses downward as it dives into the date cell.');

assert.equal(api.cockpitFlyPaperPlane({ fromRect:{ left:10, top:10, width:20, height:20 }, toRect:{ left:300, top:100, width:40, height:40 }, owner:{ _motionV2Enabled:false } }), false, 'Disabled motion skips the flight entirely.');
assert.equal(api.cockpitFlyPaperPlane({ fromRect:null, toRect:null, owner:{ _motionV2Enabled:true } }), false, 'Missing drag geometry cannot start a flight.');
console.log('Motion V2 checks passed');
