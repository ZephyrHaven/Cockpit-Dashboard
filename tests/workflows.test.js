#!/usr/bin/env node

const assert = require('node:assert/strict');

class MiniMoment {
  constructor(value) { this.date = value instanceof MiniMoment ? new Date(value.valueOf()) : new Date(value); }
  clone(){ return new MiniMoment(this); } valueOf(){ return this.date.valueOf(); } toISOString(){ return this.date.toISOString(); }
  format(pattern){
    const iso = this.date.toISOString();
    if (pattern === 'YYYY-MM-DD') return iso.slice(0, 10);
    if (pattern === 'HH:mm') return iso.slice(11, 16);
    if (pattern === 'YYYY-MM-DD HH:mm') return iso.slice(0, 16).replace('T', ' ');
    return iso;
  }
}
global.window = { moment:(value=Date.now()) => new MiniMoment(value) };
global.obs = { Modal:class { constructor(){} open(){ return this; } close(){} }, Notice:class { constructor(text){ notices.push(text); } } };
const notices = [];

const api = require('../src/workflows.js');

assert.equal(api.workflowTimeoutMs(30), 30000, 'Shell timeout seconds are converted to milliseconds for execFile.');
assert.equal(api.workflowTimeoutMs(1), 5000, 'Shell timeout respects the configured minimum before conversion.');
assert.equal(api.workflowTimeoutMs(99999), 1800000, 'Shell timeout respects the configured maximum before conversion.');

// ── 数据模型 ────────────────────────────────────────────────────────────────
{
  const normalized = api.normalizeWorkflows([
    { id:'wf-ok', name:'巡检', enabled:true, trusted:true, steps:[
      { type:'shell', text:'echo hi', timeoutSeconds:1, retryCount:99, continueOnError:true },
      { type:'push', text:'提醒', condition:{ when:'last-output-contains', text:'HI!' } },
      { type:'nonsense', text:'被丢弃' },
      { type:'append-daily', text:'' }
    ], runs:Array.from({ length:25 }, (_, index) => ({ at:new Date(index).toISOString(), status:'success' })) },
    { id:'wf-untrusted', name:'未信任', enabled:true, trusted:false, steps:[{ type:'shell', text:'rm -rf /' }] },
    { name:'缺 ID' }, { id:'wf-empty', name:'', steps:[] }
  ]);
  assert.equal(normalized.length, 2);
  const ok = normalized[0];
  assert.equal(ok.steps.length, 2, 'Invalid steps are dropped.');
  assert.equal(ok.steps[0].timeoutSeconds, 5, 'Timeout is clamped to the minimum.');
  assert.equal(ok.steps[0].retryCount, 3, 'Retries are clamped to the maximum.');
  assert.equal(ok.steps[1].condition.when, 'last-output-contains');
  assert.equal(ok.runs.length, 20, 'Run history is capped.');
  assert.equal(normalized[1].enabled, false, 'Shell workflows need explicit trust before they can be enabled.');
}

// ── 插值与条件 ──────────────────────────────────────────────────────────────
{
  global.window.moment = () => new MiniMoment(Date.parse('2026-08-12T09:30:00.000Z'));
  assert.equal(api.workflowInterpolate('{date} {time} {{last_output}}', { lastOutput:' 上一部输出 \n'.repeat(300) + '结尾' }), '2026-08-12 09:30 ' + (' 上一部输出 \n'.repeat(300) + '结尾').trim().slice(-2000));
  assert.equal(api.stepConditionAllows({ condition:{ when:'always' } }, null), true);
  assert.equal(api.stepConditionAllows({ condition:{ when:'last-ok' } }, null), false, 'Dependency conditions never fire without a previous step.');
  assert.equal(api.stepConditionAllows({ condition:{ when:'last-failed' } }, { ok:false }), true);
  assert.equal(api.stepConditionAllows({ condition:{ when:'last-output-contains', text:'disk' } }, { ok:true, output:'DISK_FULL' }), true, 'Output matching is case-insensitive.');
  assert.equal(api.stepConditionAllows({ condition:{ when:'last-output-not-contains', text:'200' } }, { ok:true, output:'500' }), true);
}

// ── 引擎执行 ────────────────────────────────────────────────────────────────
const state = { workflows:[] };
const appended = []; const todos = []; const pushes = [];
const plugin = {
  app:{ isMobile:false, commands:{ executeCommandById:(id) => id === 'test.cmd' ? {} : false } },
  loadData:async () => state,
  mutateData:async (fn) => { fn(state); },
  scheduledTasks:{
    appendDailyNote:async (text) => { appended.push(text); return 'appended'; },
    createTodoFromTemplate:async (text) => { todos.push(text); return 'todo'; },
    pushNotification:async (text) => { pushes.push(text); return 'sent'; }
  }
};
const engine = new api.CockpitWorkflowEngine(plugin, { sleep:async () => {} });
const seed = async (workflow) => { state.workflows = api.normalizeWorkflows([workflow]); };

(async () => {
// 成功链路：Shell 输出经 {{last_output}} 传给下一步
await seed({ id:'flow', name:'链路', enabled:true, steps:[
  { type:'shell', text:'echo hello' },
  { type:'append-daily', text:'结果：{{last_output}}' },
  { type:'create-todo', text:'复核 {date}' }
]});
{
  const outcome = await engine.run('flow', { trigger:'schedule' });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.status, 'success');
  assert.deepEqual(appended, ['结果：hello'], 'Previous step stdout flows into the next step.');
  assert.match(todos[0], /复核 2026-08-12/);
  const record = state.workflows[0].runs[0];
  assert.equal(record.status, 'success');
  assert.equal(record.trigger, 'schedule');
  assert.equal(state.workflows[0].lastRunAt !== '', true);
}

// 条件跳过 + 失败中止 + 失败推送
{
  appended.length = 0; pushes.length = 0;
  await seed({ id:'guard', name:'守卫', enabled:true, notifyOnFailure:true, steps:[
    { type:'shell', text:'exit 3' },
    { type:'push', text:'不会执行', condition:{ when:'last-ok' } }
  ]});
  const outcome = await engine.run('guard', {});
  assert.equal(outcome.status, 'aborted', 'A failed step without continueOnError aborts the run.');
  assert.equal(outcome.record.steps.length, 1, 'Steps after an abort are not recorded as runs.');
  assert.equal(outcome.record.steps[0].status, 'failed');
  assert.equal(pushes.length, 1, 'notifyOnFailure routes a failure push.');
  assert.match(pushes[0], /守卫/);
  assert.equal(state.workflows[0].runs[0].status, 'aborted');
}

// continueOnError + 重试计数
{
  pushes.length = 0;
  await seed({ id:'retry', name:'重试', enabled:true, steps:[
    { type:'shell', text:'exit 7', retryCount:2, continueOnError:true },
    { type:'push', text:'仍然提醒' }
  ]});
  const outcome = await engine.run('retry', {});
  assert.equal(outcome.status, 'failed', 'A continueOnError failure marks the run failed without aborting.');
  assert.equal(outcome.record.steps[0].attempts, 3, 'Retries run up to retryCount + 1 attempts.');
  assert.deepEqual(pushes, ['仍然提醒'], 'Downstream steps still run after a tolerated failure.');
}

// 应用命令分支 + 忙碌互斥
{
  await seed({ id:'cmd', name:'命令', enabled:true, steps:[{ type:'obsidian-command', text:'test.cmd' }] });
  assert.equal((await engine.run('cmd', {})).status, 'success');
  await seed({ id:'cmd2', name:'命令2', enabled:true, steps:[{ type:'obsidian-command', text:'missing.cmd' }] });
  assert.equal((await engine.run('cmd2', {})).status, 'aborted', 'An unavailable command fails its step and aborts by default.');
  engine.running.add('cmd');
  assert.equal((await engine.run('cmd', {})).busy, true, 'Concurrent runs of one workflow are rejected.');
  engine.running.delete('cmd');
}

// 运行日志落盘 + 20 条封顶
{
  const files = new Map();
  const logPlugin = { ...plugin, app:{ ...plugin.app, vault:{
    getAbstractFileByPath:(path) => files.has(path) ? { path } : null,
    createFolder:async () => {},
    create:async (path, content) => { files.set(path, content); },
    read:async (file) => files.get(file.path) || '',
    modify:async (file, content) => { files.set(file.path, content); }
  }}, loadData:async () => state };
  state.workflows = api.normalizeWorkflows([{ id:'logged', name:'落盘', enabled:true, logNote:'Logs/Flows.md', steps:[{ type:'append-daily', text:'x' }] }]);
  const logEngine = new api.CockpitWorkflowEngine(logPlugin, { sleep:async () => {} });
  await logEngine.run('logged', {});
  assert.match(files.get('Logs/Flows.md'), /# 落盘 运行日志/);
  assert.match(files.get('Logs/Flows.md'), /追加日记: success/);
  for (let index = 0; index < 25; index++) await logEngine.run('logged', {});
  assert.equal(state.workflows[0].runs.length, 20, 'Persisted run history stays capped at 20.');
}

// upsert / remove 走共享变更队列
{
  await engine.upsert({ id:'up', name:' Upsert ', enabled:false, steps:[{ type:'push', text:'hi' }] });
  assert.equal(state.workflows.some((item) => item.id === 'up'), true);
  await engine.remove('up');
  assert.equal(state.workflows.some((item) => item.id === 'up'), false);
  await assert.rejects(() => engine.upsert({ id:'', name:'坏数据', steps:[] }), /invalid-workflow/);
}

console.log('Workflow engine checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
