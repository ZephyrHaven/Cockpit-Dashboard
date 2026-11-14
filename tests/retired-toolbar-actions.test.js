const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const files = ['constants', 'toolbar-defs', 'toolbar-config', 'toolbar-custom', 'scheduled-tasks', 'workflows', '_framework'];
const sources = files.map((name) => fs.readFileSync(path.join(__dirname, '../src', `${name}.js`), 'utf8'));
const commands = [];
const { CockpitView, ScheduledTaskService, CockpitWorkflowEngine, isConfigurableToolbarAction, scheduledToolbarActions } = vm.runInNewContext(
  sources.join('\n') + '\n;({ CockpitView, ScheduledTaskService, CockpitWorkflowEngine, isConfigurableToolbarAction, scheduledToolbarActions })',
  {
    module:{ exports:{} },
    require:(id) => id === 'child_process'
      ? { exec:(command, callback) => { commands.push(command); callback(null, '', ''); } }
      : require(id),
    obs:{ ItemView:class {}, Plugin:class {}, Notice:class {} },
    window:{ moment:() => ({ format:() => '' }) }
  }
);

async function run() {
  const view = Object.create(CockpitView.prototype);
  Object.assign(view, {
    app:{ isMobile:false }, _language:'en', _deletedToolbarActions:new Set(),
    _toolbarCmds:{ Hermes:{ command:'old-hermes' }, '驾驶舱':{ command:'old-h5' }, '工作日志':{ command:'work-log-command', label:'My work log' } }
  });
  const state = { scheduledTasks:[], workflows:[] };
  const plugin = {
    app:{ workspace:{ getLeavesOfType:() => [{ view }] } },
    loadData:async () => state,
    mutateData:async (update) => update(state)
  };
  const logs = [];
  const scheduler = plugin.scheduledTasks = new ScheduledTaskService(plugin);
  scheduler.appendLog = async (entry) => logs.push(entry);
  const workflows = new CockpitWorkflowEngine(plugin);

  for (const [id, label] of [['hermes', 'Hermes'], ['cockpit-h5', 'Cockpit H5']]) {
    assert.equal(view._toolbarButtons().some((button) => button.action === id), false);
    assert.equal(isConfigurableToolbarAction(id), false);
    assert.equal(scheduledToolbarActions(view).some((action) => action.id === id), false);

    state.scheduledTasks = [{ id:'task', name:'Old task', kind:'toolbar-action', command:id, enabled:true }];
    assert.equal(await scheduler.runTask('task', { trigger:'schedule' }), false);
    assert.ok(logs.at(-1).stderr.includes(label));
    assert.match(logs.at(-1).stderr, /choose another action/i);

    state.workflows = [{ id:'workflow', name:'Old workflow', enabled:true, steps:[{ type:'toolbar-action', text:id }] }];
    const outcome = await workflows.run('workflow');
    assert.equal(outcome.ok, false);
    assert.ok(outcome.record.steps[0].error.includes(label));
    assert.match(outcome.record.steps[0].error, /choose another action/i);
  }
  assert.deepEqual(commands, []);
  assert.equal(isConfigurableToolbarAction('work-log'), true);
  assert.equal(view._toolbarButtons().find((button) => button.action === 'work-log')?.label, 'My work log');
  await scheduler.runToolbarAction('work-log');
  assert.deepEqual(commands, ['work-log-command']);
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
