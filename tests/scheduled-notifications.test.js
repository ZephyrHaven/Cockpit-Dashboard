#!/usr/bin/env node

const assert = require('node:assert/strict');

global.window = {
  moment:() => ({ format:() => '2026-10-18 21:30:00' })
};

const { ScheduledTaskService } = require('../src/scheduled-tasks.js');

(async () => {
  const deliveries = [];
  const plugin = {
    loadData:async () => ({ language:'zh-CN' }),
    serverChan:{
      getConfig:async () => ({ channels:{ serverChan:{enabled:true}, bark:{enabled:true}, meow:{enabled:false}, email:{enabled:false} } }),
      sendChannel:async (id, title, body) => {
        deliveries.push({ id, title, body });
        if (id === 'bark') throw new Error('offline');
        return true;
      }
    }
  };
  const service = new ScheduledTaskService(plugin);
  const task = {
    name:'每日备份',
    notification:{ enabled:true, statuses:['success','failed'], channels:[], includeManual:false }
  };

  const scheduled = await service.sendResultNotification(task, { status:'success', durationMs:1250, stderr:'', trigger:'schedule' });
  assert.equal(scheduled.status, 'partial', 'One failed channel does not erase successful deliveries.');
  assert.equal(scheduled.sent, 1);
  assert.equal(scheduled.failed, 1);
  assert.deepEqual(deliveries.map((item) => item.id), ['serverChan','bark']);
  assert.match(deliveries[0].title, /定时任务已完成/);
  assert.match(deliveries[0].body, /耗时：1.3 秒/);

  const manual = await service.sendResultNotification(task, { status:'success', durationMs:1, stderr:'', trigger:'manual' });
  assert.equal(manual.status, 'skipped', 'Manual runs stay quiet unless the task opts in.');
  assert.equal(deliveries.length, 2);

  const selected = await service.sendResultNotification({ ...task, notification:{ ...task.notification, channels:['serverChan'] } }, { status:'failed', durationMs:50, stderr:'disk full', trigger:'event' });
  assert.equal(selected.status, 'sent');
  assert.equal(selected.sent, 1);
  assert.match(deliveries[2].body, /错误：disk full/);

  console.log('Scheduled notification checks passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
