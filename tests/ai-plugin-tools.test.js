#!/usr/bin/env node

const assert = require('node:assert/strict');
const { createCockpitPluginDataToolsRegistry } = require('../src/ai-plugin-tools.js');

const plugin = {
  app:{ vault:{} },
  alarms:{ load:async () => [{ id:'alarm-1', name:'晨会', enabled:true, scheduleType:'weekdays', time:'09:00', weekdays:[1,2,3,4,5], onceAt:null, snoozedUntil:null, todoId:'' }] },
  countdowns:{ load:async () => [{ id:'count-1', name:'上线', enabled:true, startAt:'2026-10-01T00:00:00.000Z', targetAt:'2026-10-20T00:00:00.000Z' }] }
};
const registry = createCockpitPluginDataToolsRegistry(plugin, {
  loadTodos:async () => [
    { id:'todo-1', text:'A', tags:['开发区'], done:false },
    { id:'todo-2', text:'B', tags:['开发区','报表'], done:true }
  ],
  loadHabits:async () => [{ id:'habit-1', name:'运动', icon:'🏃', created:'2026-10-01', log:['2026-10-15','2026-10-17'] }],
  now:() => Date.parse('2026-10-17T12:00:00+08:00'),
  today:() => '2026-10-17'
});

assert.deepEqual(
  registry.definitions('readonly').map((tool) => tool.function.name),
  ['cockpit_list_projects','cockpit_list_habits','cockpit_list_alarms','cockpit_list_countdowns'],
  'The first plugin-data expansion is read-only in every permission mode.'
);

(async () => {
  const projects = await registry.execute('cockpit_list_projects', { limit:10 });
  assert.deepEqual(projects.data.items[0], { tag:'开发区', total:2, done:1, open:1, progress:50 });

  const habits = await registry.execute('cockpit_list_habits', { limit:10 });
  assert.deepEqual(habits.data.items[0], { id:'habit-1', name:'运动', icon:'🏃', created:'2026-10-01', totalCheckIns:2, lastCheckIn:'2026-10-17', checkedToday:true });

  const alarms = await registry.execute('cockpit_list_alarms', { limit:10 });
  assert.deepEqual(alarms.data.items[0], { id:'alarm-1', name:'晨会', enabled:true, scheduleType:'weekdays', time:'09:00', weekdays:[1,2,3,4,5], onceAt:null, snoozedUntil:null, todoId:'' });

  const countdowns = await registry.execute('cockpit_list_countdowns', { limit:10 });
  assert.equal(countdowns.data.items[0].remainingMs, Date.parse('2026-10-20T00:00:00.000Z') - Date.parse('2026-10-17T12:00:00+08:00'));
  assert.equal(await registry.execute('unknown_tool', {}), null);

  console.log('AI plugin-data tool checks passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
