#!/usr/bin/env node
const assert = require('node:assert/strict');
const { createCockpitAgentPlanRegistry, normalizeCockpitAgentPlan } = require('../src/ai-plan.js');
const { CockpitAgentToolHub } = require('../src/ai-tools.js');

const registry = createCockpitAgentPlanRegistry();
const hub = new CockpitAgentToolHub([registry]);
assert.ok(hub.definitions('readonly').some((item) => item.function.name === 'agent_update_plan'), 'Planning is available in read-only mode.');
assert.equal(hub.describe('agent_update_plan').mutates, false);
assert.match(hub.environment('read-write'), /multi-step work/);
const result = hub.execute('agent_update_plan', { steps:[
  { text:'Read the project', status:'completed' },
  { text:'Review changes', status:'in_progress' },
  { text:'Run checks', status:'pending' }
] });
Promise.resolve(result).then((value) => {
  assert.equal(value.ok, true);
  assert.equal(value.data.steps.length, 3);
  assert.throws(() => normalizeCockpitAgentPlan([{ text:'a', status:'in_progress' }, { text:'b', status:'in_progress' }]), /one plan step/i);
  assert.throws(() => normalizeCockpitAgentPlan([{ text:'', status:'pending' }]), /invalid/i);
  assert.throws(() => registry.execute('agent_update_plan', { steps:[], extra:true }), /Invalid plan arguments/);
  console.log('AI task plan checks passed');
}).catch((error) => { console.error(error); process.exitCode = 1; });
