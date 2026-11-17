#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let t = 0;
const context = vm.createContext({ console, Date, Math, Number, Map, Array, Object, String, JSON, isFinite,
  performance:{ now: () => { t += 10; return t; } } });
const src = fs.readFileSync(path.join(__dirname, '../src/perf-trace.js'), 'utf8');
vm.runInContext(src + ';globalThis.pf={cockpitPerfMark,cockpitPerfEnd,cockpitPerfRecord,cockpitPerfMeasure,cockpitPerfResetModuleBuilds,cockpitPerfRecordModule,cockpitPerfSummary,cockpitPerfReset,cockpitPerfRecordRefresh,cockpitPerfRefreshHeat};', context);
const pf = context.pf;
pf.cockpitPerfReset();
pf.cockpitPerfMark('x');
const ms = pf.cockpitPerfEnd('x', 'renderDashboard');
assert.ok(ms > 0, 'end returns positive elapsed');
let s = pf.cockpitPerfSummary();
assert.equal(Math.round(s.firstPaintMs), Math.round(ms));
pf.cockpitPerfRecord('silentRefresh', 5);
pf.cockpitPerfRecord('silentRefresh', 15);
s = pf.cockpitPerfSummary();
assert.equal(s.refresh.count, 2);
assert.equal(s.refresh.avg, 10);
assert.equal(s.refresh.max, 15);
pf.cockpitPerfResetModuleBuilds();
pf.cockpitPerfRecordModule('habits', 30);
pf.cockpitPerfRecordModule('alarms', 80);
s = pf.cockpitPerfSummary();
assert.equal(s.slowestModules[0].module, 'alarms');
assert.equal(s.slowestModules[0].ms, 80);
pf.cockpitPerfReset();
(async () => {
  await pf.cockpitPerfMeasure('ok', async () => 1);
  let threw = false;
  try { await pf.cockpitPerfMeasure('boom', async () => { throw new Error('x'); }); } catch (e) { threw = true; }
  assert.ok(threw, 'measure rethrows');
  s = pf.cockpitPerfSummary();
  assert.ok(s.slowestLabels.some((l) => l.label === 'ok'));
  assert.ok(s.slowestLabels.some((l) => l.label === 'boom'));
  assert.equal(pf.cockpitPerfEnd('nope'), null);
  pf.cockpitPerfReset();
  pf.cockpitPerfRecord('z', -5);
  pf.cockpitPerfRecord('z', NaN);
  assert.equal(pf.cockpitPerfSummary().sampleCount, 0);
  // refresh heat
  pf.cockpitPerfReset();
  pf.cockpitPerfRecordRefresh(['todos','focus'], 3);
  pf.cockpitPerfRecordRefresh(['todos'], 2);
  const heat = pf.cockpitPerfRefreshHeat();
  assert.equal(heat.eventCount, 2);
  assert.equal(heat.totalFiles, 5);
  assert.equal(heat.avgFiles, 2.5);
  assert.equal(heat.scopes[0].scope, 'todos');
  assert.equal(heat.scopes[0].count, 2);
  console.log('perf-trace: all assertions passed');
})();
