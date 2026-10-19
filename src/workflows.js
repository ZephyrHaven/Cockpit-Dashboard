// workflows.js — 自动化流程引擎：面向运维场景的多步骤流水线。
// 与定时任务的区别：任务 = 单个动作 + 计划；流程 = 有序步骤链 +
// 步骤条件（跳过/继续）+ 失败重试 + 输出传递（{{last_output}}）+ 结果路由（失败推送 / 运行日志落盘）。
// 触发方式：模块内手动运行；或作为定时任务的一种动作类型，从而复用时间计划与事件触发。
// 安全模型：Shell 步骤仅在桌面端可用，含 Shell 的流程必须确认信任后才能启用；
// 配置走共享 data.json 变更队列；运行历史保存在 data.json（每流程最多 20 条），不新建 Markdown。

const { execFile } = require('child_process');

const WORKFLOW_LIMITS = Object.freeze({
  maxWorkflows:30,
  maxSteps:12,
  runsKept:20,
  nameChars:80,
  idChars:64,
  textChars:6000,
  conditionChars:300,
  notePathChars:300,
  stepTimeoutMin:5,
  stepTimeoutMax:1800,
  retryMax:3,
  waitMax:600,
  outputTailChars:4000
});

const WORKFLOW_STEP_TYPES = ['shell', 'obsidian-command', 'toolbar-action', 'append-daily', 'create-todo', 'push', 'wait'];
const WORKFLOW_CONDITION_WHEN = ['always', 'last-ok', 'last-failed', 'last-output-contains', 'last-output-not-contains'];

function workflowId() {
  try { return 'wf-' + globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 16); } catch (e) {}
  return 'wf-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function workflowStepLabel(type, en = false) {
  const labels = {
    shell: en ? 'Shell' : 'Shell 命令',
    'obsidian-command': en ? 'App command' : '应用命令',
    'toolbar-action': en ? 'Toolbar' : 'Toolbar 动作',
    'append-daily': en ? 'Daily note' : '追加日记',
    'create-todo': en ? 'Todo' : '创建待办',
    'push': en ? 'Push' : '推送通知',
    'wait': en ? 'Wait' : '等待'
  };
  return labels[type] || type;
}

function workflowTimeoutMs(timeoutSeconds) {
  const seconds = Math.max(WORKFLOW_LIMITS.stepTimeoutMin, Math.min(WORKFLOW_LIMITS.stepTimeoutMax, Math.round(Number(timeoutSeconds) || 300)));
  return seconds * 1000;
}

function normalizeWorkflows(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).slice(0, WORKFLOW_LIMITS.maxWorkflows).map((item) => {
    const id = String(item?.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, WORKFLOW_LIMITS.idChars);
    const name = String(item?.name || '').trim().slice(0, WORKFLOW_LIMITS.nameChars);
    if (!id || seen.has(id) || !name) return null;
    seen.add(id);
    const steps = (Array.isArray(item?.steps) ? item.steps : []).slice(0, WORKFLOW_LIMITS.maxSteps).map((step, index) => {
      const type = WORKFLOW_STEP_TYPES.includes(step?.type) ? step.type : null;
      if (!type) return null;
      const text = String(step?.text || '').slice(0, WORKFLOW_LIMITS.textChars);
      if (type !== 'wait' && !text.trim()) return null;
      const when = WORKFLOW_CONDITION_WHEN.includes(step?.condition?.when) ? step.condition.when : 'always';
      return {
        id:String(step?.id || 's' + (index + 1)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 's' + (index + 1),
        type, text,
        timeoutSeconds:type === 'shell' ? Math.max(WORKFLOW_LIMITS.stepTimeoutMin, Math.min(WORKFLOW_LIMITS.stepTimeoutMax, Math.round(Number(step?.timeoutSeconds) || 300))) : 300,
        continueOnError:step?.continueOnError === true,
        retryCount:type === 'shell' ? Math.max(0, Math.min(WORKFLOW_LIMITS.retryMax, Math.round(Number(step?.retryCount) || 0))) : 0,
        condition:{ when, text:String(step?.condition?.text || '').slice(0, WORKFLOW_LIMITS.conditionChars) },
        waitSeconds:type === 'wait' ? Math.max(1, Math.min(WORKFLOW_LIMITS.waitMax, Math.round(Number(step?.waitSeconds) || 5))) : 0
      };
    }).filter(Boolean);
    const hasShell = steps.some((step) => step.type === 'shell');
    const trusted = item?.trusted === true;
    const logNote = String(item?.logNote || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').slice(0, WORKFLOW_LIMITS.notePathChars);
    const createdAt = Number.isFinite(Date.parse(item?.createdAt || '')) ? new Date(item.createdAt).toISOString() : new Date().toISOString();
    const runs = (Array.isArray(item?.runs) ? item.runs : []).slice(0, WORKFLOW_LIMITS.runsKept).map((run) => ({
      at:Number.isFinite(Date.parse(run?.at || '')) ? new Date(run.at).toISOString() : new Date().toISOString(),
      trigger:['manual','schedule','event'].includes(run?.trigger) ? run.trigger : 'manual',
      status:['success','failed','aborted'].includes(run?.status) ? run.status : 'failed',
      durationMs:Math.max(0, Math.round(Number(run?.durationMs) || 0)),
      steps:Array.isArray(run?.steps) ? run.steps.slice(0, WORKFLOW_LIMITS.maxSteps) : []
    }));
    return {
      id, name, steps,
      enabled:item?.enabled === true && (!hasShell || trusted) && steps.length > 0,
      trusted,
      notifyOnFailure:item?.notifyOnFailure === true,
      logNote,
      runs,
      createdAt,
      updatedAt:Number.isFinite(Date.parse(item?.updatedAt || '')) ? new Date(item.updatedAt).toISOString() : createdAt,
      lastRunAt:Number.isFinite(Date.parse(item?.lastRunAt || '')) ? new Date(item.lastRunAt).toISOString() : '',
      lastStatus:['success','failed','aborted'].includes(item?.lastStatus) ? item.lastStatus : ''
    };
  }).filter(Boolean);
}

// 步骤内容插值：日期占位符 + 上一步输出尾部（自动截断，防止超长输出撑爆后续命令）。
function workflowInterpolate(text, context = {}) {
  const now = window.moment();
  const tail = String(context.lastOutput || '').trim().slice(-2000);
  return String(text || '')
    .replace(/\{date\}/g, now.format('YYYY-MM-DD'))
    .replace(/\{time\}/g, now.format('HH:mm'))
    .replace(/\{datetime\}/g, now.format('YYYY-MM-DD HH:mm'))
    .replace(/\{\{date\}\}/g, now.format('YYYY-MM-DD'))
    .replace(/\{\{time\}\}/g, now.format('HH:mm'))
    .replace(/\{\{datetime\}\}/g, now.format('YYYY-MM-DD HH:mm'))
    .replace(/\{\{last_output\}\}/g, tail);
}

function stepConditionAllows(step, lastResult) {
  const when = step?.condition?.when || 'always';
  if (when === 'always') return true;
  if (!lastResult) return false;
  const output = String(lastResult.output || '');
  const needle = String(step?.condition?.text || '');
  if (when === 'last-ok') return lastResult.ok === true;
  if (when === 'last-failed') return lastResult.ok !== true;
  if (when === 'last-output-contains') return !!needle && output.toLowerCase().includes(needle.toLowerCase());
  if (when === 'last-output-not-contains') return !needle || !output.toLowerCase().includes(needle.toLowerCase());
  return true;
}

class CockpitWorkflowEngine {
  constructor(plugin, dependencies = {}) {
    this.plugin = plugin;
    this.dependencies = { sleep:dependencies.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))) };
    this.running = new Set();
    this.listeners = new Set();
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify(event = { type:'data' }) { this.listeners.forEach((listener) => { try { listener(event); } catch (e) {} }); }
  async load() { return normalizeWorkflows((await this.plugin.loadData())?.workflows); }
  async save(workflows) {
    const normalized = normalizeWorkflows(workflows);
    await this.plugin.mutateData((data) => { data.workflows = normalized; });
    this.notify({ type:'data' });
    return normalized;
  }
  async upsert(workflow) {
    const normalized = normalizeWorkflows([workflow])[0];
    if (!normalized) throw new Error('invalid-workflow');
    await this.plugin.mutateData((data) => {
      const list = normalizeWorkflows(data.workflows);
      const index = list.findIndex((item) => item.id === normalized.id);
      if (index >= 0) list[index] = normalized;
      else list.push(normalized);
      data.workflows = list.slice(0, WORKFLOW_LIMITS.maxWorkflows);
    });
    this.notify({ type:'data' });
    return normalized;
  }
  async remove(id) {
    await this.plugin.mutateData((data) => { data.workflows = normalizeWorkflows(data.workflows).filter((item) => item.id !== id); });
    this.notify({ type:'data' });
  }
  _actions() {
    const service = this.plugin.scheduledTasks;
    const unavailable = () => { throw new Error('action-layer-unavailable'); };
    return {
      appendDaily:(text) => service?.appendDailyNote?.(text) ?? unavailable(),
      createTodo:(text) => service?.createTodoFromTemplate?.(text) ?? unavailable(),
      push:(text) => service?.pushNotification?.(text) ?? unavailable(),
      toolbar:(id) => service?.runToolbarAction?.(id) ?? unavailable()
    };
  }
  _runShell(command, timeoutSeconds) {
    const timeout = workflowTimeoutMs(timeoutSeconds);
    return new Promise((resolve, reject) => {
      const shell = cockpitShellInvocation(command);
      execFile(shell.file, shell.args, { timeout, maxBuffer:1024 * 1024, encoding:'utf8', windowsHide:true }, (error, stdout, stderr) => {
        if (error) { error.message = (error.message || 'shell-failed') + (stderr ? ('\n' + String(stderr).slice(0, 500)) : ''); reject(error); return; }
        resolve(String(stdout || '') + (stderr ? '\n' + String(stderr) : ''));
      });
    });
  }
  async _executeStep(step, lastResult) {
    const text = workflowInterpolate(step.text, { lastOutput:lastResult?.output || '' });
    try {
      if (step.type === 'wait') {
        await this.dependencies.sleep(Math.max(1, Math.min(WORKFLOW_LIMITS.waitMax, step.waitSeconds || 1)) * 1000);
        return { ok:true, output:'' };
      }
      if (step.type === 'shell') {
        if (this.plugin.app.isMobile) throw new Error('shell-mobile-unsupported');
        const output = await this._runShell(text, step.timeoutSeconds);
        return { ok:true, output:String(output || '').slice(0, WORKFLOW_LIMITS.outputTailChars) };
      }
      if (step.type === 'obsidian-command') {
        const ok = this.plugin.app.commands.executeCommandById(text);
        if (ok === false) throw new Error('command-unavailable');
        return { ok:true, output:'' };
      }
      const actions = this._actions();
      if (step.type === 'toolbar-action') { const result = await actions.toolbar(text); return { ok:true, output:String(result?.stdout || '') }; }
      if (step.type === 'append-daily') { const result = await actions.appendDaily(text); return { ok:true, output:String(result || '') }; }
      if (step.type === 'create-todo') { const result = await actions.createTodo(text); return { ok:true, output:String(result || '') }; }
      if (step.type === 'push') { const result = await actions.push(text); return { ok:true, output:String(result || '') }; }
      throw new Error('unknown-step-type');
    } catch (error) {
      return { ok:false, output:'', error:String(error?.message || error).slice(0, WORKFLOW_LIMITS.outputTailChars) };
    }
  }
  async run(id, options = {}) {
    if (this.running.has(id)) return { ok:false, busy:true, status:'busy' };
    const workflow = (await this.load()).find((item) => item.id === id);
    if (!workflow) throw new Error('workflow-not-found');
    this.running.add(id);
    this.notify({ type:'run-start', workflowId:id, stepCount:workflow.steps.length });
    const startedAt = Date.now();
    const stepResults = [];
    let lastResult = null;
    let anyFailed = false;
    let aborted = false;
    try {
      for (const [stepIndex, step] of workflow.steps.entries()) {
        if (!stepConditionAllows(step, lastResult)) {
          stepResults.push({ id:step.id, type:step.type, status:'skipped' });
          this.notify({ type:'step-skipped', workflowId:id, stepId:step.id, stepIndex });
          continue;
        }
        this.notify({ type:'step-start', workflowId:id, stepId:step.id, stepIndex });
        const maxAttempts = 1 + Math.max(0, Math.min(WORKFLOW_LIMITS.retryMax, step.retryCount || 0));
        let attempt = 0;
        let result = null;
        while (attempt < maxAttempts) {
          attempt += 1;
          result = await this._executeStep(step, lastResult);
          if (result.ok) break;
          if (attempt < maxAttempts) await this.dependencies.sleep(1000);
        }
        lastResult = result;
        stepResults.push({ id:step.id, type:step.type, status:result.ok ? 'success' : 'failed', attempts:attempt, error:result.ok ? '' : String(result.error || '').slice(0, 300) });
        this.notify({ type:result.ok ? 'step-success' : 'step-failure', workflowId:id, stepId:step.id, stepIndex, attempts:attempt });
        if (!result.ok) {
          anyFailed = true;
          if (!step.continueOnError) { aborted = true; break; }
        }
      }
    } finally {
      this.running.delete(id);
    }
    const status = aborted ? 'aborted' : (anyFailed ? 'failed' : 'success');
    const record = { at:new Date().toISOString(), trigger:['manual','schedule','event'].includes(options.trigger) ? options.trigger : 'manual', status, durationMs:Date.now() - startedAt, steps:stepResults };
    await this.plugin.mutateData((data) => {
      const list = normalizeWorkflows(data.workflows);
      const target = list.find((item) => item.id === id);
      if (!target) return;
      target.runs = [record, ...(target.runs || [])].slice(0, WORKFLOW_LIMITS.runsKept);
      target.lastRunAt = record.at;
      target.lastStatus = status;
      data.workflows = list;
    });
    // 结果路由：失败推送 + 运行摘要落盘。路由失败绝不改变运行结果本身。
    try {
      const latest = (await this.load()).find((item) => item.id === id);
      if ((status !== 'success') && latest?.notifyOnFailure) {
        await this.plugin.scheduledTasks?.pushNotification?.(`工作流「${latest.name}」${status === 'aborted' ? '中止' : '失败'}`);
      }
      if (latest?.logNote) await this._appendRunLog(latest, record);
    } catch (error) { console.warn('[Cockpit workflow] result routing failed', error); }
    this.notify({ type:'run-complete', workflowId:id, status, durationMs:record.durationMs });
    this.notify({ type:'data' });
    return { ok:status === 'success', status, record };
  }
  async _appendRunLog(workflow, record) {
    const vault = this.plugin.app.vault;
    const path = workflow.logNote;
    if (!path || !path.toLowerCase().endsWith('.md')) return;
    const summarySteps = record.steps.map((step) => `- ${workflowStepLabel(step.type)}: ${step.status}${step.error ? '（' + step.error.slice(0, 120) + '）' : ''}`).join('\n');
    const entry = `\n## ${window.moment().format('YYYY-MM-DD HH:mm')} · ${record.trigger} · ${record.status} (${Math.round(record.durationMs / 100) / 10}s)\n${summarySteps}\n`;
    const file = vault.getAbstractFileByPath?.(path);
    if (!file) {
      const folder = path.split('/').slice(0, -1).join('/');
      if (folder && !vault.getAbstractFileByPath?.(folder)) { try { await vault.createFolder(folder); } catch (e) {} }
      await vault.create(path, `# ${workflow.name} 运行日志\n` + entry);
      return;
    }
    const content = typeof vault.read === 'function' ? await vault.read(file) : '';
    await vault.modify(file, content + (content && !content.endsWith('\n') ? '\n' : '') + entry);
  }
}

// 运维巡检模板：Shell 产出标记 → 条件步骤断言标记 → 告警/记录。全部中性占位，无个人路径。
const WORKFLOW_TEMPLATES = [
  {
    name:'磁盘空间巡检',
    steps:[
      { type:'shell', text:"df -h / | awk 'NR==2{gsub(\"%\",\"\",$5); if ($5+0>=90) print \"DISK_FULL\"}'", timeoutSeconds:60 },
      { type:'push', condition:{ when:'last-output-contains', text:'DISK_FULL' }, text:'磁盘空间已超过 90%，请清理（{datetime}）' }
    ]
  },
  {
    name:'网站可达性检查',
    steps:[
      { type:'shell', text:"curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://example.com", timeoutSeconds:30 },
      { type:'push', condition:{ when:'last-output-not-contains', text:'200' }, text:'网站状态异常，请检查（{datetime}）' }
    ]
  },
  {
    name:'备份新鲜度检查',
    steps:[
      { type:'shell', text:"find /path/to/backup -name '*.bak' -mtime -1 | head -1", timeoutSeconds:60 },
      { type:'push', condition:{ when:'last-output-not-contains', text:'.bak' }, text:'备份超过 1 天未更新，请检查备份任务（{datetime}）' }
    ]
  },
  {
    name:'工作日开场准备',
    steps:[
      { type:'append-daily', text:'## {datetime} 开始工作' },
      { type:'create-todo', text:'查看今日日程与晨报' }
    ]
  }
];

// ===== 仪表盘模块与编辑器 =====
// 视觉规范与定时任务模块完全一致：模块行复用 -scheduler-row 网格与状态胶囊，
// 编辑器 / 运行历史使用同一套 tokyo-night 自定义浮层（-scheduler-backdrop / -scheduler-dialog），
// 不使用宿主默认弹窗，保证整个仪表盘观感统一。

function workflowRunStatusText(status, en) {
  const labels = { success:[en ? 'Success' : '成功'], failed:[en ? 'Failed' : '失败'], aborted:[en ? 'Aborted' : '中止'], busy:[en ? 'Running' : '运行中'], skipped:[en ? 'Skipped' : '已跳过'] };
  return (labels[status] || labels.failed)[0];
}

function workflowOverviewStats(workflows, scheduledTasks = []) {
  const list = Array.isArray(workflows) ? workflows : [];
  const workflowIds = new Set(list.map((workflow) => workflow.id));
  const runs = list.flatMap((workflow) => Array.isArray(workflow.runs) ? workflow.runs : [])
    .filter((run) => ['success', 'failed', 'aborted'].includes(run?.status))
    .sort((a, b) => Date.parse(b.at || '') - Date.parse(a.at || ''))
    .slice(0, 20);
  const automaticTasks = (Array.isArray(scheduledTasks) ? scheduledTasks : []).filter((task) => (
    task?.enabled === true && task.kind === 'workflow' && workflowIds.has(task.command)
  ));
  return {
    total:list.length,
    enabled:list.filter((workflow) => workflow.enabled).length,
    attention:list.filter((workflow) => ['failed', 'aborted'].includes(workflow.lastStatus)).length,
    totalSteps:list.reduce((sum, workflow) => sum + (Array.isArray(workflow.steps) ? workflow.steps.length : 0), 0),
    automaticTriggers:automaticTasks.length,
    eventTriggers:automaticTasks.filter((task) => task.schedule?.type === 'event').length,
    recentRuns:runs.length,
    successRate:runs.length ? Math.round(runs.filter((run) => run.status === 'success').length / runs.length * 100) : null
  };
}

function workflowOpenOverlay(view, titleText, trigger = null) {
  const en = view._lang() === 'en';
  const overlay = document.createElement('div'); overlay.className = PLUGIN_ID + '-scheduler-backdrop'; if (typeof cockpitAnimateOverlay === 'function') cockpitAnimateOverlay(overlay, { trigger, owner:view });
  const panel = overlay.createDiv({ cls:PLUGIN_ID + '-scheduler-dialog' });
  const head = panel.createDiv({ cls:PLUGIN_ID + '-scheduler-dialog-head' });
  head.createDiv({ cls:PLUGIN_ID + '-scheduler-dialog-title', text:titleText });
  const close = head.createEl('button', { attr:{ type:'button', 'aria-label':en ? 'Close' : '关闭' } });
  obs.setIcon(close, 'x'); close.onclick = () => overlay.remove();
  makeCockpitDialogDraggable(panel, head, { label:titleText });
  overlay.onclick = (event) => { if (event.target === overlay) overlay.remove(); };
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); overlay.remove(); } });
  return { overlay, panel };
}

function openWorkflowSchedule(view, workflow) {
  const en = view._lang() === 'en';
  const draft = {
    id:scheduledTaskId(),
    name:workflow.name + (en ? ' · schedule' : ' · 定时运行'),
    kind:'workflow',
    command:workflow.id,
    enabled:true,
    trusted:false,
    schedule:{ type:'daily', intervalMinutes:60, time:'09:00', weekdays:[1,2,3,4,5] },
    missedPolicy:'run-once',
    timeoutSeconds:300,
    createdAt:new Date().toISOString()
  };
  openScheduledTaskEditor(view, draft, { asNew:true }).catch((error) => {
    console.warn('[Cockpit workflow schedule editor]', error);
    new obs.Notice((en ? 'Could not open schedule editor: ' : '无法打开定时设置：') + (error?.message || error));
  });
}

function buildWorkflowsModule(view, root) {
  const plugin = view._plugin;
  const engine = plugin.workflows;
  if (!engine) return null;
  const en = view._lang() === 'en';
  const title = root.createDiv({ cls:PLUGIN_ID+'-section-title', text:view._t('sections.workflows') });
  title.dataset.section = 'workflows-title';
  const body = root.createDiv({ cls:PLUGIN_ID+'-workflows' });
  body.dataset.section = 'workflows-body';
  const openEditor = (workflowIdValue = null, trigger = null) => openWorkflowEditor(view, workflowIdValue, trigger).catch((error) => {
    console.warn('[Cockpit workflows editor]', error);
    new obs.Notice((en ? 'Could not open workflow editor: ' : '无法打开流程编辑器：') + (error?.message || error));
  });
  let renderRevision = 0;
  const applyProgress = (event) => {
    if (!event?.workflowId || event.type === 'data') return false;
    const card = body.querySelector('[data-workflow-id="' + event.workflowId + '"]');
    if (!card) return true;
    const state = card.querySelector('.' + PLUGIN_ID + '-workflow-card-state');
    const nodes = Array.from(card.querySelectorAll('.' + PLUGIN_ID + '-workflow-card-step'));
    if (event.type === 'run-start') {
      card.classList.remove('success','failed','aborted'); card.classList.add('running');
      card.dataset.runState = 'charge'; if (state) state.setText(en ? 'Running' : '运行中');
      nodes.forEach((node) => { node.classList.remove('is-active','is-success','is-failed','is-skipped'); node.removeAttribute('aria-current'); });
    } else if (event.type === 'step-start') {
      card.dataset.runState = 'conduct';
      const node = nodes[event.stepIndex]; node?.classList.add('is-active'); node?.setAttribute('aria-current','step');
    } else if (event.type === 'step-success' || event.type === 'step-failure' || event.type === 'step-skipped') {
      const node = nodes[event.stepIndex];
      node?.classList.remove('is-active'); node?.removeAttribute('aria-current');
      node?.classList.add(event.type === 'step-success' ? 'is-success' : (event.type === 'step-failure' ? 'is-failed' : 'is-skipped'));
      if (node && event.type !== 'step-skipped') cockpitSettle(node, event.type === 'step-success' ? 'success' : 'failed', view);
    } else if (event.type === 'run-complete') {
      card.dataset.runState = event.status === 'success' ? 'crystallize' : 'halt';
      card.classList.remove('running'); card.classList.add(event.status);
      if (state) state.setText(workflowRunStatusText(event.status, en));
      cockpitSettle(card, event.status === 'success' ? 'success' : 'failed', view);
    }
    return true;
  };

  const render = async () => {
    const revision = ++renderRevision;
    const scheduledPromise = plugin.scheduledTasks?.load
      ? plugin.scheduledTasks.load().catch(() => [])
      : Promise.resolve([]);
    const [workflows, scheduledTasks] = await Promise.all([engine.load(), scheduledPromise]);
    if (revision !== renderRevision) return;
    body.empty();
    const now = window.moment();
    const stats = workflowOverviewStats(workflows, scheduledTasks);
    const isRunning = workflows.some((workflow) => engine.running.has(workflow.id));
    const linkedTasks = scheduledTasks.filter((task) => task?.enabled && task.kind === 'workflow' && workflows.some((workflow) => workflow.id === task.command));
    const nextAutomatic = linkedTasks
      .filter((task) => task.schedule?.type !== 'event')
      .map((task) => ({ task, at:nextScheduledRun(task, now.valueOf()) }))
      .filter((item) => item.at)
      .sort((a, b) => a.at.valueOf() - b.at.valueOf())[0] || null;

    let healthKey = 'healthy';
    let healthTitle = en ? 'Automation is ready' : '自动化运行正常';
    let healthDescription = en ? 'Your enabled workflows are ready to run.' : '已启用流程均处于可运行状态。';
    if (stats.attention) {
      healthKey = 'attention';
      healthTitle = en ? `${stats.attention} workflow${stats.attention > 1 ? 's' : ''} need attention` : `${stats.attention} 条流程需要关注`;
      healthDescription = en ? 'Review the latest failed or stopped runs.' : '建议检查最近失败或中止的运行记录。';
    } else if (isRunning) {
      healthKey = 'running';
      healthTitle = en ? 'Automation is running' : '自动化正在运行';
      healthDescription = en ? 'A workflow is currently processing its steps.' : '当前有流程正在依次执行步骤。';
    } else if (!stats.enabled && stats.total) {
      healthKey = 'paused';
      healthTitle = en ? 'All workflows are paused' : '所有流程均已停用';
      healthDescription = en ? 'Enable a workflow when you are ready to automate it.' : '准备好后，可启用流程并配置自动触发。';
    } else if (!stats.total) {
      healthKey = 'empty';
      healthTitle = en ? 'Build your first automation' : '创建第一条自动化流程';
      healthDescription = en ? 'Connect actions into a repeatable, observable pipeline.' : '把多个操作串成可重复、可观察的执行链。';
    }

    const overview = body.createDiv({ cls:PLUGIN_ID+'-workflow-overview '+healthKey });
    const overviewHead = overview.createDiv({ cls:PLUGIN_ID+'-workflow-overview-head' });
    const identity = overviewHead.createDiv({ cls:PLUGIN_ID+'-workflow-overview-identity' });
    const mark = identity.createDiv({ cls:PLUGIN_ID+'-workflow-overview-mark' });
    obs.setIcon(mark, healthKey === 'attention' ? 'triangle-alert' : (healthKey === 'running' ? 'loader-circle' : 'workflow'));
    const overviewCopy = identity.createDiv({ cls:PLUGIN_ID+'-workflow-overview-copy' });
    overviewCopy.createDiv({ cls:PLUGIN_ID+'-workflow-overview-kicker', text:en ? 'AUTOMATION HEALTH' : '自动化健康度' });
    overviewCopy.createDiv({ cls:PLUGIN_ID+'-workflow-overview-title', text:healthTitle });
    overviewCopy.createDiv({ cls:PLUGIN_ID+'-workflow-overview-description', text:healthDescription });
    const overviewActions = overviewHead.createDiv({ cls:PLUGIN_ID+'-workflow-overview-actions' });
    if (stats.attention) {
      const attention = overviewActions.createEl('button', { cls:PLUGIN_ID+'-workflow-overview-attention', attr:{ type:'button' } });
      obs.setIcon(attention.createSpan(), 'circle-alert');
      attention.createSpan({ text:en ? 'Review' : '查看异常' });
      attention.onclick = () => body.querySelector('.'+PLUGIN_ID+'-workflow-card.failed, .'+PLUGIN_ID+'-workflow-card.aborted')?.scrollIntoView({ behavior:'smooth', block:'center' });
    }
    const add = overviewActions.createEl('button', { cls:'primary '+PLUGIN_ID+'-workflow-overview-add', attr:{ type:'button' } });
    obs.setIcon(add.createSpan(), 'plus');
    add.createSpan({ text:en ? 'New workflow' : '新建流程' });
    add.onclick = (event) => openEditor(null, event.currentTarget);

    const metrics = overview.createDiv({ cls:PLUGIN_ID+'-workflow-overview-metrics' });
    const metricItems = [
      { label:en ? 'Workflows' : '流程', value:String(stats.total), detail:en ? `${stats.totalSteps} steps` : `${stats.totalSteps} 个步骤` },
      { label:en ? 'Enabled' : '已启用', value:`${stats.enabled}/${stats.total}`, detail:stats.enabled ? (en ? 'Ready to run' : '可随时运行') : (en ? 'None active' : '暂无启用') },
      { label:en ? 'Recent success' : '近期成功率', value:stats.successRate == null ? '—' : `${stats.successRate}%`, detail:stats.recentRuns ? (en ? `${stats.recentRuns} runs sampled` : `统计最近 ${stats.recentRuns} 次`) : (en ? 'Awaiting runs' : '等待首次运行') },
      { label:en ? 'Auto triggers' : '自动触发', value:String(stats.automaticTriggers), detail:stats.eventTriggers ? (en ? `${stats.eventTriggers} event listeners` : `${stats.eventTriggers} 个事件监听`) : (en ? 'Schedules and events' : '定时与事件') }
    ];
    metricItems.forEach((item, index) => {
      const metric = metrics.createDiv({ cls:PLUGIN_ID+'-workflow-overview-metric'+(index === 2 && stats.successRate != null && stats.successRate < 80 ? ' is-warning' : '') });
      metric.createSpan({ cls:PLUGIN_ID+'-workflow-overview-metric-label', text:item.label });
      metric.createSpan({ cls:PLUGIN_ID+'-workflow-overview-metric-value', text:item.value });
      metric.createSpan({ cls:PLUGIN_ID+'-workflow-overview-metric-detail', text:item.detail });
    });

    const activity = overview.createDiv({ cls:PLUGIN_ID+'-workflow-overview-activity' });
    const activityIcon = activity.createSpan({ cls:PLUGIN_ID+'-workflow-overview-activity-icon' });
    if (nextAutomatic) {
      obs.setIcon(activityIcon, 'calendar-clock');
      activity.createSpan({ cls:PLUGIN_ID+'-workflow-overview-activity-label', text:en ? 'NEXT AUTOMATIC RUN' : '下一次自动触发' });
      const workflow = workflows.find((item) => item.id === nextAutomatic.task.command);
      activity.createSpan({ cls:PLUGIN_ID+'-workflow-overview-activity-name', text:workflow?.name || nextAutomatic.task.name });
      activity.createSpan({ cls:PLUGIN_ID+'-workflow-overview-activity-time', text:scheduledDayLabel(nextAutomatic.at, now, en)+' '+nextAutomatic.at.format('HH:mm')+' · '+scheduledRelativeLabel(nextAutomatic.at, now, en) });
    } else if (stats.eventTriggers) {
      obs.setIcon(activityIcon, 'zap');
      activity.createSpan({ cls:PLUGIN_ID+'-workflow-overview-activity-label', text:en ? 'EVENT AUTOMATION' : '事件自动化' });
      activity.createSpan({ cls:PLUGIN_ID+'-workflow-overview-activity-name', text:en ? `${stats.eventTriggers} listener${stats.eventTriggers > 1 ? 's' : ''} active` : `${stats.eventTriggers} 个事件正在监听` });
      activity.createSpan({ cls:PLUGIN_ID+'-workflow-overview-activity-time', text:en ? 'Runs when matching activity occurs' : '匹配事件发生时自动运行' });
    } else {
      obs.setIcon(activityIcon, 'mouse-pointer-click');
      activity.createSpan({ cls:PLUGIN_ID+'-workflow-overview-activity-label', text:en ? 'MANUAL MODE' : '当前为手动模式' });
      activity.createSpan({ cls:PLUGIN_ID+'-workflow-overview-activity-name', text:en ? 'Add a schedule or event from any workflow card' : '可从任一流程卡片添加定时或事件触发' });
    }

    if (!workflows.length) {
      const empty = body.createDiv({ cls:PLUGIN_ID+'-workflow-empty' });
      const emptyIcon = empty.createDiv({ cls:PLUGIN_ID+'-workflow-empty-icon' });
      obs.setIcon(emptyIcon, 'blocks');
      empty.createDiv({ cls:PLUGIN_ID+'-workflow-empty-title', text:en ? 'Turn repeatable work into a workflow' : '把重复操作变成自动化流程' });
      empty.createDiv({ cls:PLUGIN_ID+'-workflow-empty-description', text:en ? 'Start from an inspection template, then connect actions, conditions and notifications.' : '可从巡检模板开始，再组合操作、条件与通知。' });
      return;
    }
    const list = body.createDiv({ cls:PLUGIN_ID+'-workflow-list' });
    workflows.forEach((workflow) => {
      const running = engine.running.has(workflow.id);
      const statusKey = running ? 'running' : (workflow.lastStatus || 'idle');
      const triggers = linkedTasks.filter((task) => task.command === workflow.id);
      const latestRun = Array.isArray(workflow.runs) ? workflow.runs[0] : null;
      const row = list.createDiv({ cls:PLUGIN_ID+'-workflow-card '+statusKey+(workflow.enabled ? '' : ' paused') });
      row.dataset.workflowId = workflow.id;
      row.dataset.motionKey = 'workflow:' + workflow.id;
      const head = row.createDiv({ cls:PLUGIN_ID+'-workflow-card-head' });
      const heading = head.createDiv({ cls:PLUGIN_ID+'-workflow-card-heading' });
      heading.createSpan({ cls:PLUGIN_ID+'-workflow-card-dot '+statusKey });
      const name = heading.createEl('button', { cls:PLUGIN_ID+'-workflow-card-name', text:workflow.name, attr:{ type:'button', title:en ? 'Edit workflow' : '编辑流程' } });
      name.onclick = (event) => openEditor(workflow.id, event.currentTarget.closest('.'+PLUGIN_ID+'-workflow-card'));
      heading.createSpan({ cls:PLUGIN_ID+'-workflow-card-state '+statusKey, text:running ? (en ? 'Running' : '运行中') : (!workflow.enabled ? (en ? 'Paused' : '已停用') : (workflow.lastStatus ? workflowRunStatusText(workflow.lastStatus, en) : (en ? 'Ready' : '待运行'))) });
      const last = head.createDiv({ cls:PLUGIN_ID+'-workflow-card-last' });
      last.createSpan({ cls:PLUGIN_ID+'-workflow-card-last-label', text:workflow.lastRunAt ? (en ? 'LAST RUN' : '最近运行') : (en ? 'STATUS' : '当前状态') });
      last.createSpan({ cls:PLUGIN_ID+'-workflow-card-last-value', text:workflow.lastRunAt ? window.moment(workflow.lastRunAt).format('MM-DD HH:mm') : (workflow.enabled ? (en ? 'Ready' : '可运行') : '—') });

      const chain = row.createDiv({ cls:PLUGIN_ID+'-workflow-card-chain', attr:{ 'aria-label':en ? 'Workflow steps' : '流程步骤' } });
      workflow.steps.slice(0, 4).forEach((step, index) => {
        const icons = { shell:'terminal', 'obsidian-command':'command', 'toolbar-action':'mouse-pointer-click', 'append-daily':'file-plus-2', 'create-todo':'list-checks', push:'bell', wait:'timer' };
        const node = chain.createDiv({ cls:PLUGIN_ID+'-workflow-card-step' });
        node.dataset.stepIndex = String(index);
        node.dataset.motionKey = 'workflow-step:' + workflow.id + ':' + step.id;
        const icon = node.createSpan({ cls:PLUGIN_ID+'-workflow-card-step-icon' });
        obs.setIcon(icon, icons[step.type] || 'circle');
        node.createSpan({ cls:PLUGIN_ID+'-workflow-card-step-index', text:String(index + 1).padStart(2, '0') });
        node.createSpan({ cls:PLUGIN_ID+'-workflow-card-step-label', text:workflowStepLabel(step.type, en) });
      });
      if (workflow.steps.length > 4) chain.createSpan({ cls:PLUGIN_ID+'-workflow-card-step-more', text:'+'+(workflow.steps.length - 4) });

      const foot = row.createDiv({ cls:PLUGIN_ID+'-workflow-card-foot' });
      const meta = foot.createDiv({ cls:PLUGIN_ID+'-workflow-card-meta' });
      if (triggers.length) {
        triggers.slice(0, 2).forEach((task) => {
          const trigger = meta.createSpan({ cls:PLUGIN_ID+'-workflow-card-trigger '+(task.schedule?.type === 'event' ? 'event' : 'schedule'), attr:{ title:scheduleLabel(task, view._lang()) } });
          obs.setIcon(trigger.createSpan(), task.schedule?.type === 'event' ? 'zap' : 'calendar-clock');
          trigger.createSpan({ text:scheduleLabel(task, view._lang()) });
        });
        if (triggers.length > 2) meta.createSpan({ cls:PLUGIN_ID+'-workflow-card-trigger-more', text:'+'+(triggers.length - 2) });
      } else {
        const manual = meta.createSpan({ cls:PLUGIN_ID+'-workflow-card-trigger manual' });
        obs.setIcon(manual.createSpan(), 'mouse-pointer-click');
        manual.createSpan({ text:en ? 'Manual' : '手动运行' });
      }
      const runMeta = meta.createSpan({ cls:PLUGIN_ID+'-workflow-card-run-meta' });
      obs.setIcon(runMeta.createSpan(), 'history');
      runMeta.createSpan({ text:latestRun ? workflowRunStatusText(latestRun.status, en)+' · '+scheduledDurationLabel(latestRun.durationMs, view._lang()) : (en ? 'No run history' : '暂无运行记录') });

      const actions = foot.createDiv({ cls:PLUGIN_ID+'-workflow-card-actions' });
      const history = actions.createEl('button', { cls:PLUGIN_ID+'-scheduler-icon-btn', attr:{ type:'button', 'aria-label':en ? 'Run history' : '运行历史' } });
      obs.setIcon(history, 'history');
      history.onclick = () => openWorkflowRuns(view, workflow.id);
      const schedule = actions.createEl('button', { cls:PLUGIN_ID+'-scheduler-icon-btn', attr:{ type:'button', 'aria-label':en ? 'Schedule workflow' : '定时运行' } });
      obs.setIcon(schedule, 'calendar-clock');
      schedule.onclick = () => openWorkflowSchedule(view, workflow);
      const edit = actions.createEl('button', { cls:PLUGIN_ID+'-scheduler-icon-btn', attr:{ type:'button', 'aria-label':en ? 'Edit' : '编辑' } });
      obs.setIcon(edit, 'pencil');
      edit.onclick = (event) => openEditor(workflow.id, event.currentTarget.closest('.'+PLUGIN_ID+'-workflow-card'));
      const toggle = actions.createEl('button', { cls:PLUGIN_ID+'-scheduler-icon-btn', attr:{ type:'button', 'aria-label':workflow.enabled ? (en ? 'Pause' : '停用') : (en ? 'Enable' : '启用') } });
      obs.setIcon(toggle, workflow.enabled ? 'pause' : 'play');
      toggle.onclick = async () => { await engine.upsert({ ...workflow, enabled:!workflow.enabled, updatedAt:new Date().toISOString() }); };
      const run = actions.createEl('button', { cls:PLUGIN_ID+'-workflow-card-run', attr:{ type:'button' } });
      obs.setIcon(run.createSpan({ cls:PLUGIN_ID+'-workflow-card-run-icon' }), running ? 'loader-circle' : 'circle-play');
      const runText = run.createSpan({ text:running ? (en ? 'Running…' : '运行中…') : (en ? 'Run now' : '立即运行') });
      run.disabled = running || (view.app.isMobile && workflow.steps.some((step) => step.type === 'shell'));
      run.onclick = async () => {
        run.disabled = true; runText.setText(en ? 'Running…' : '运行中…');
        try {
          const outcome = await engine.run(workflow.id, { trigger:'manual' });
          new obs.Notice(outcome.ok ? (en ? 'Workflow succeeded.' : '流程运行成功。') : (en ? 'Workflow finished: ' : '流程结束：') + workflowRunStatusText(outcome.status, en));
        } catch (error) {
          new obs.Notice((en ? 'Could not run workflow: ' : '无法运行流程：') + (error?.message || error));
        }
        render().catch(() => {});
      };
    });
    cockpitRevealList(list, '.'+PLUGIN_ID+'-workflow-card', view);
  };
  view._workflowsUnsubscribe?.();
  view._workflowsUnsubscribe = engine.subscribe((event) => {
    if (applyProgress(event)) return;
    render().catch((e) => console.warn('[Cockpit workflows UI]', e));
  });
  render().catch((e) => console.warn('[Cockpit workflows UI]', e));
  view._makeModuleCollapsible('workflows', title, body);
  return render;
}

async function openWorkflowRuns(view, workflowIdValue) {
  const en = view._lang() === 'en';
  const engine = view._plugin.workflows;
  const all = await engine.load();
  const workflow = all.find((item) => item.id === workflowIdValue);
  const { overlay, panel } = workflowOpenOverlay(view, (workflow?.name || '') + ' · ' + (en ? 'Run history' : '运行历史'));
  panel.classList.add('logs');
  const list = panel.createDiv({ cls:PLUGIN_ID+'-workflow-runs' });
  if (!workflow?.runs?.length) { list.createDiv({ cls:PLUGIN_ID+'-scheduler-empty', text:en ? 'No runs yet.' : '还没有运行记录。' }); }
  workflow?.runs?.forEach((run) => {
    const block = list.createDiv({ cls:PLUGIN_ID+'-workflow-run' + (run.status === 'success' ? ' ok' : ' bad') });
    block.createDiv({ cls:PLUGIN_ID+'-workflow-run-head', text:run.at.replace('T', ' ').slice(0, 16) + ' · ' + run.trigger + ' · ' + workflowRunStatusText(run.status, en) + ' · ' + (Math.round(run.durationMs / 100) / 10) + 's' });
    run.steps.forEach((step) => {
      block.createDiv({ cls:PLUGIN_ID+'-workflow-run-step', text:workflowStepLabel(step.type, en) + ' → ' + workflowRunStatusText(step.status, en) + (step.error ? ' · ' + step.error.slice(0, 120) : '') });
    });
  });
  document.body.appendChild(overlay);
}

async function openWorkflowEditor(view, workflowIdValue = null, trigger = null) {
  const en = view._lang() === 'en';
  const engine = view._plugin.workflows;
  const all = await engine.load();
  const existing = workflowIdValue ? all.find((item) => item.id === workflowIdValue) : null;
  const draft = existing ? JSON.parse(JSON.stringify(existing)) : { id:workflowId(), name:'', enabled:false, trusted:false, notifyOnFailure:true, logNote:'', steps:[] };
  const { overlay, panel } = workflowOpenOverlay(view, existing ? (en ? 'Edit workflow' : '编辑流程') : (en ? 'New workflow' : '新建流程'), trigger);
  panel.classList.add(PLUGIN_ID+'-workflow-editor');
  const field = (label) => { const wrap = panel.createDiv({ cls:PLUGIN_ID+'-scheduler-field' }); wrap.createDiv({ cls:PLUGIN_ID+'-scheduler-label', text:label }); return wrap; };

  const nameInput = field(en ? 'Name' : '名称').createEl('input', { attr:{ type:'text', maxlength:String(WORKFLOW_LIMITS.nameChars), placeholder:en ? 'e.g. Disk inspection' : '例如：磁盘空间巡检' } });
  nameInput.value = draft.name;

  const templateWrap = field(en ? 'Start from template (new only)' : '从模板开始（仅新建时）');
  const templateSel = templateWrap.createEl('select');
  templateSel.createEl('option', { text:en ? '— choose —' : '— 选择 —', attr:{ value:'' } });
  WORKFLOW_TEMPLATES.forEach((template, index) => templateSel.createEl('option', { text:template.name, attr:{ value:String(index) } }));

  const stepsWrap = field(en ? 'Steps (run top to bottom)' : '步骤（自上而下执行）');
  stepsWrap.addClass(PLUGIN_ID+'-workflow-steps-field');
  const stepsList = stepsWrap.createDiv({ cls:PLUGIN_ID+'-workflow-steps' });
  const addStep = stepsWrap.createEl('button', { cls:PLUGIN_ID+'-workflow-add-step', text:en ? '+ Add step' : '+ 添加步骤', attr:{ type:'button' } });

  const rebuildSteps = () => {
    const first = cockpitCaptureLayout(stepsList.querySelectorAll('[data-motion-key]'));
    stepsList.empty();
    draft.steps.forEach((step, index) => {
      const row = stepsList.createDiv({ cls:PLUGIN_ID+'-workflow-step' });
      row.dataset.motionKey = 'editor-step:' + step.id;
      const head = row.createDiv({ cls:PLUGIN_ID+'-workflow-step-head' });
      head.createSpan({ cls:PLUGIN_ID+'-workflow-step-index', text:String(index + 1).padStart(2, '0') });
      const typeSel = head.createEl('select');
      WORKFLOW_STEP_TYPES.forEach((type) => typeSel.createEl('option', { text:workflowStepLabel(type, en), attr:{ value:type } }));
      typeSel.value = step.type;
      typeSel.onchange = () => { step.type = typeSel.value; rebuildSteps(); };
      const move = (offset) => {
        const target = index + offset;
        if (target < 0 || target >= draft.steps.length) return;
        const swap = draft.steps[target]; draft.steps[target] = draft.steps[index]; draft.steps[index] = swap;
        rebuildSteps();
      };
      const up = head.createEl('button', { attr:{ type:'button', 'aria-label':en ? 'Move up' : '上移' } }); obs.setIcon(up, 'arrow-up'); up.onclick = () => move(-1);
      const down = head.createEl('button', { attr:{ type:'button', 'aria-label':en ? 'Move down' : '下移' } }); obs.setIcon(down, 'arrow-down'); down.onclick = () => move(1);
      up.disabled = index === 0;
      down.disabled = index === draft.steps.length - 1;
      const remove = head.createEl('button', { attr:{ type:'button', 'aria-label':en ? 'Remove' : '删除' } }); obs.setIcon(remove, 'trash-2'); remove.onclick = () => { draft.steps.splice(index, 1); rebuildSteps(); };

      if (step.type === 'wait') {
        const waitRow = row.createDiv({ cls:PLUGIN_ID+'-workflow-step-opts' });
        waitRow.createSpan({ text:en ? 'Seconds' : '秒数' });
        const waitInput = waitRow.createEl('input', { attr:{ type:'number', min:'1', max:String(WORKFLOW_LIMITS.waitMax) } });
        waitInput.value = String(step.waitSeconds || 5);
        waitInput.oninput = () => { step.waitSeconds = Math.max(1, Math.min(WORKFLOW_LIMITS.waitMax, Math.round(Number(waitInput.value) || 5))); };
      } else {
        const textArea = row.createEl('textarea', { attr:{ rows:step.type === 'shell' ? '3' : '2', maxlength:String(WORKFLOW_LIMITS.textChars), placeholder:step.type === 'shell' ? (en ? 'Shell command; {{last_output}} carries the previous step output' : 'Shell 命令；{{last_output}} 引用上一步输出') : (en ? 'Content / target. Supports {date} {time} {datetime} and {{last_output}}' : '内容 / 目标，支持 {date} {time} {datetime} 与 {{last_output}}') } });
        textArea.value = step.text;
        textArea.oninput = () => { step.text = textArea.value; };
      }
      if (step.type === 'shell') {
        const shellRow = row.createDiv({ cls:PLUGIN_ID+'-workflow-step-opts' });
        shellRow.createSpan({ text:en ? 'Timeout(s)' : '超时(秒)' });
        const timeoutInput = shellRow.createEl('input', { attr:{ type:'number', min:String(WORKFLOW_LIMITS.stepTimeoutMin), max:String(WORKFLOW_LIMITS.stepTimeoutMax) } });
        timeoutInput.value = String(step.timeoutSeconds || 300);
        timeoutInput.oninput = () => { step.timeoutSeconds = Math.max(WORKFLOW_LIMITS.stepTimeoutMin, Math.min(WORKFLOW_LIMITS.stepTimeoutMax, Math.round(Number(timeoutInput.value) || 300))); };
        shellRow.createSpan({ text:en ? 'Retries' : '重试' });
        const retryInput = shellRow.createEl('input', { attr:{ type:'number', min:'0', max:String(WORKFLOW_LIMITS.retryMax) } });
        retryInput.value = String(step.retryCount || 0);
        retryInput.oninput = () => { step.retryCount = Math.max(0, Math.min(WORKFLOW_LIMITS.retryMax, Math.round(Number(retryInput.value) || 0))); };
        const continueLabel = shellRow.createEl('label', { cls:PLUGIN_ID+'-workflow-inline-toggle' });
        const continueCheck = continueLabel.createEl('input', { cls:PLUGIN_ID+'-workflow-switch', attr:{ type:'checkbox', role:'switch' } });
        continueCheck.checked = step.continueOnError === true;
        continueCheck.onchange = () => { step.continueOnError = continueCheck.checked; };
        continueLabel.createSpan({ text:en ? 'Continue on error' : '失败后继续' });
      }
      const condRow = row.createDiv({ cls:PLUGIN_ID+'-workflow-step-opts' });
      condRow.createSpan({ text:en ? 'Run when' : '执行条件' });
      const whenSel = condRow.createEl('select');
      [['always', en ? 'Always' : '总是'], ['last-ok', en ? 'Previous succeeded' : '上一步成功'], ['last-failed', en ? 'Previous failed' : '上一步失败'], ['last-output-contains', en ? 'Output contains' : '输出包含'], ['last-output-not-contains', en ? 'Output NOT contains' : '输出不包含']].forEach(([value, label]) => whenSel.createEl('option', { text:label, attr:{ value } }));
      whenSel.value = step.condition?.when || 'always';
      whenSel.onchange = () => { step.condition = { ...(step.condition || {}), when:whenSel.value }; rebuildSteps(); };
      if (['last-output-contains', 'last-output-not-contains'].includes(whenSel.value)) {
        const condInput = condRow.createEl('input', { attr:{ type:'text', maxlength:String(WORKFLOW_LIMITS.conditionChars), placeholder:en ? 'e.g. DISK_FULL' : '例如 DISK_FULL' } });
        condInput.value = step.condition?.text || '';
        condInput.oninput = () => { step.condition = { when:whenSel.value, text:condInput.value }; };
      }
    });
    if (!draft.steps.length) stepsList.createDiv({ cls:PLUGIN_ID+'-workflow-steps-empty', text:en ? 'No steps yet.' : '还没有步骤。' });
    addStep.setText((en ? '+ Add step' : '+ 添加步骤') + `  ${draft.steps.length}/${WORKFLOW_LIMITS.maxSteps}`);
    addStep.disabled = draft.steps.length >= WORKFLOW_LIMITS.maxSteps;
    cockpitPlayFlip(stepsList, first, view);
  };
  const appendStep = () => {
    if (draft.steps.length >= WORKFLOW_LIMITS.maxSteps) { new obs.Notice(en ? 'Step limit reached.' : '步骤数量已达上限。'); return; }
    draft.steps.push({ id:'s-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), type:'shell', text:'', timeoutSeconds:300, continueOnError:false, retryCount:0, condition:{ when:'always', text:'' }, waitSeconds:5 });
    rebuildSteps();
    const lastStep = stepsList.lastElementChild;
    // 强制一次布局提交，避免宿主 WebView 将连续新增延迟到下一个输入事件才绘制。
    void stepsList.offsetHeight;
    window.requestAnimationFrame(() => lastStep?.scrollIntoView?.({ behavior:'auto', block:'nearest' }));
  };
  // 指针按下时就完成新增，避免按钮点击被当前输入框的 blur / DOM 重建吞掉。
  addStep.onpointerdown = (event) => { if (event.button !== 0) return; event.preventDefault(); appendStep(); };
  addStep.onclick = (event) => { if (event.detail === 0) appendStep(); };
  templateSel.onchange = () => {
    const template = WORKFLOW_TEMPLATES[Number(templateSel.value)];
    if (!template || draft.steps.length) return;
    draft.steps = template.steps.map((step, index) => ({ id:'s' + (index + 1), timeoutSeconds:300, continueOnError:false, retryCount:0, condition:{ when:'always', text:'' }, waitSeconds:5, ...step }));
    if (!existing && !nameInput.value.trim()) nameInput.value = template.name;
    rebuildSteps();
  };
  rebuildSteps();

  const notifyLabel = field(en ? 'Push when failed' : '失败时推送').createDiv({ cls:PLUGIN_ID+'-scheduler-check' });
  const notifyCheck = notifyLabel.createEl('input', { attr:{ type:'checkbox' } });
  notifyCheck.checked = draft.notifyOnFailure === true;
  notifyCheck.onchange = () => { draft.notifyOnFailure = notifyCheck.checked; };
  notifyLabel.createSpan({ text:en ? 'Send a push via enabled channels when the run fails' : '运行失败时通过已启用渠道推送提醒' });

  const logWrap = field(en ? 'Append run log to note (optional)' : '运行日志追加到笔记（可选）');
  const logInput = logWrap.createEl('input', { attr:{ type:'text', maxlength:String(WORKFLOW_LIMITS.notePathChars), placeholder:en ? 'e.g. Logs/Workflows.md' : '例如 Logs/Workflows.md' } });
  logInput.value = draft.logNote || '';

  const hasShell = () => draft.steps.some((step) => step.type === 'shell');
  const permissions = panel.createDiv({ cls:PLUGIN_ID+'-workflow-permissions' });
  permissions.createDiv({ cls:PLUGIN_ID+'-workflow-permissions-title', text:en ? 'Run permissions' : '运行权限' });
  permissions.createDiv({ cls:PLUGIN_ID+'-workflow-permissions-hint', text:en ? 'Shell workflows require explicit trust before they can be enabled.' : '含 Shell 命令的流程需要先确认信任，之后才能启用。' });
  const trustLabel = permissions.createEl('label', { cls:PLUGIN_ID+'-workflow-permission-row' });
  const trustCopy = trustLabel.createDiv({ cls:PLUGIN_ID+'-workflow-permission-copy' });
  trustCopy.createSpan({ text:en ? 'Trust Shell commands' : '信任 Shell 命令' });
  trustCopy.createEl('small', { text:en ? 'I have reviewed the commands and confirm they are safe on this machine.' : '我已检查流程中的命令，并确认可在本机安全运行。' });
  const trustCheck = trustLabel.createEl('input', { cls:PLUGIN_ID+'-workflow-switch', attr:{ type:'checkbox', role:'switch' } });
  trustCheck.checked = draft.trusted === true;

  const enableLabel = permissions.createEl('label', { cls:PLUGIN_ID+'-workflow-permission-row' });
  const enableCopy = enableLabel.createDiv({ cls:PLUGIN_ID+'-workflow-permission-copy' });
  enableCopy.createSpan({ text:en ? 'Enable workflow' : '启用流程' });
  enableCopy.createEl('small', { text:en ? 'Allow manual, scheduled, and event-triggered runs.' : '允许手动运行，以及定时和事件触发。' });
  const enableCheck = enableLabel.createEl('input', { cls:PLUGIN_ID+'-workflow-switch', attr:{ type:'checkbox', role:'switch' } });
  enableCheck.checked = draft.enabled === true;
  const refreshEnable = () => { enableCheck.disabled = hasShell() && !trustCheck.checked; };
  enableCheck.onchange = () => { draft.enabled = enableCheck.checked; };
  trustCheck.onchange = () => { draft.trusted = trustCheck.checked; refreshEnable(); };

  const error = panel.createDiv({ cls:PLUGIN_ID+'-scheduler-error' });
  const footer = panel.createDiv({ cls:PLUGIN_ID+'-scheduler-footer' });
  if (existing) { const remove = footer.createEl('button', { cls:'danger', text:en ? 'Delete' : '删除', attr:{ type:'button' } }); remove.onclick = async () => { if (!window.confirm(en ? 'Delete this workflow?' : '删除这个自动化流程？')) return; await engine.remove(draft.id); overlay.remove(); }; }
  const cancel = footer.createEl('button', { text:en ? 'Cancel' : '取消', attr:{ type:'button' } }); cancel.onclick = () => overlay.remove();
  const save = footer.createEl('button', { cls:'primary', text:en ? 'Save workflow' : '保存流程', attr:{ type:'button' } });
  save.onclick = async () => {
    error.setText('');
    const name = nameInput.value.trim();
    if (!name) { error.setText(en ? 'Please enter a name.' : '请输入流程名称。'); return; }
    if (!draft.steps.length) { error.setText(en ? 'Add at least one step.' : '请至少添加一个步骤。'); return; }
    if (hasShell() && !trustCheck.checked) { error.setText(en ? 'Confirm shell trust before saving shell steps.' : '包含 Shell 步骤时请先勾选信任确认。'); return; }
    draft.name = name;
    draft.enabled = enableCheck.checked && (!hasShell() || trustCheck.checked);
    draft.logNote = logInput.value.trim();
    draft.updatedAt = new Date().toISOString();
    save.disabled = true;
    try { await engine.upsert(draft); overlay.remove(); } catch (e) { error.setText((en ? 'Could not save: ' : '保存失败：') + (e?.message || e)); save.disabled = false; }
  };
  refreshEnable();
  document.body.appendChild(overlay);
  setTimeout(() => nameInput.focus(), 20);
}

function createWorkflowEngine(plugin, dependencies = {}) {
  return new CockpitWorkflowEngine(plugin, dependencies);
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = {
    WORKFLOW_LIMITS, WORKFLOW_STEP_TYPES, WORKFLOW_CONDITION_WHEN, WORKFLOW_TEMPLATES,
    workflowId, workflowStepLabel, workflowTimeoutMs, normalizeWorkflows, workflowInterpolate,
    stepConditionAllows, workflowOverviewStats, CockpitWorkflowEngine, createWorkflowEngine
  };
}
